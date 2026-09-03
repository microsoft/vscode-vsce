import chalk from "chalk";
import * as os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import type {
	SecretLintCoreConfig,
	SecretLintCoreResult,
	SecretLintRuleCreator,
	SecretLintRulePresetCreator
} from "@secretlint/types";
import { log } from "./util";

interface SecretLintFinding {
	message: string;
	ruleId: string;
	level: "error" | "warning" | "note";
	filePath: string;
	startLine?: number;
	startColumn?: number;
	endLine?: number;
	endColumn?: number;
}

interface SecretLintResult {
	ok: boolean;
	results: SecretLintFinding[];
}

const secretsScanningRules = [
	{
		id: "@secretlint/secretlint-rule-preset-recommend",
		rules: [
			{
				id: "@secretlint/secretlint-rule-basicauth",
				allowMessageIds: ["BasicAuth"]
			},
			{
				id: "@secretlint/secretlint-rule-privatekey",
				options: {
					allows: [
						// Allow all keys which do not start and end with the BEGIN/END PRIVATE KEY and has at least 50 characters in between
						// https://github.com/microsoft/vscode-vsce/issues/1147
						"/^(?![\\s\\S]*-----BEGIN .*PRIVATE KEY-----[A-Za-z0-9+/=\\r\\n]{50,}-----END .*PRIVATE KEY-----)[\\s\\S]*$/"
					]
				}
			}, {
				id: "@secretlint/secretlint-rule-npm",
				options: {
					allows: [
						// An npm token has the prefix npm_ followed by 36 Base62 characters (30 random + 6-character checksum), totaling 40 characters.
						// https://github.com/microsoft/vscode-vsce/issues/1153
						"/^(?!(?:npm_[0-9A-Za-z]{36})$).+$/"
					]
				}
			}
		]
	}
];

const dotEnvRules = [
	{
		id: "@secretlint/secretlint-rule-no-dotenv"
	}
];

async function getConfig(scanSecrets: boolean, scanDotEnv: boolean): Promise<SecretLintCoreConfig> {
	const [{ creator: recommend }, { creator: noDotenv }] = await Promise.all([
		importSecretLintRule<SecretLintRulePresetCreator>("@secretlint/secretlint-rule-preset-recommend"),
		importSecretLintRule<SecretLintRuleCreator>("@secretlint/secretlint-rule-no-dotenv")
	]);
	const rules: SecretLintCoreConfig["rules"] = [];
	if (scanSecrets) {
		rules.push({
			...secretsScanningRules[0],
			rule: recommend
		});
	}
	if (scanDotEnv) {
		rules.push({
			...dotEnvRules[0],
			rule: noDotenv
		});
	}

	return { rules };
}

function importSecretLintRule<T>(packageName: string): Promise<{ creator: T }> {
	return import(packageName);
}

async function mapConcurrently<T, U>(values: T[], mapper: (value: T) => Promise<U>): Promise<U[]> {
	const results = new Array<U>(values.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < values.length) {
			const index = nextIndex++;
			results[index] = await mapper(values[index]);
		}
	}

	const workerCount = Math.min(os.availableParallelism(), values.length);
	await Promise.all(Array.from({ length: workerCount }, worker));
	return results;
}

export async function lintFiles(
	filePaths: string[],
	scanSecrets: boolean,
	scanDotEnv: boolean
): Promise<SecretLintResult> {
	let results;
	try {
		const [{ lintSource }, { createRawSource }, config] = await Promise.all([
			import("@secretlint/core"),
			import("@secretlint/source-creator"),
			getConfig(scanSecrets, scanDotEnv)
		]);
		results = await mapConcurrently(filePaths, async filePath =>
			lintSource({
				source: await createRawSource(filePath),
				options: {
					config,
					maskSecrets: false
				}
			})
		);
	} catch (error) {
		log.error('Error occurred while scanning secrets (files):', error);
		process.exit(1);
	}

	return parseResult(results);
}

export async function lintText(
	content: string,
	fileName: string,
	scanSecrets: boolean,
	scanDotEnv: boolean
): Promise<SecretLintResult> {
	let result;
	try {
		const [{ lintSource }, config] = await Promise.all([
			import("@secretlint/core"),
			getConfig(scanSecrets, scanDotEnv)
		]);
		result = await lintSource({
			source: {
				content,
				filePath: fileName,
				ext: path.extname(fileName),
				contentType: "text"
			},
			options: {
				config,
				maskSecrets: false
			}
		});
	} catch (error) {
		log.error('Error occurred while scanning secrets (content):', error);
		process.exit(1);
	}
	return parseResult([result]);
}

function parseResult(fileResults: SecretLintCoreResult[]): SecretLintResult {
	const results = fileResults.flatMap(fileResult =>
		fileResult.messages.map((message): SecretLintFinding => ({
			message: message.message,
			ruleId: message.ruleParentId ? `${message.ruleParentId} > ${message.ruleId}` : message.ruleId,
			level: message.severity === "info" ? "note" : message.severity,
			filePath: process.env.SARIF_URI_ABSOLUTE
				? pathToFileURL(fileResult.filePath).toString()
				: path.relative(process.cwd(), fileResult.filePath),
			startLine: fixLine(message.loc.start.line),
			startColumn: fixColumn(message.loc.start.column),
			endLine: fixLine(message.loc.end.line),
			endColumn: fixColumn(message.loc.end.column)
		}))
	);

	return {
		ok: !fileResults.some(fileResult => fileResult.messages.some(message => message.severity === "error")),
		results
	};
}

function fixLine(value: number | null): number | undefined {
	return value === null ? undefined : value === 0 ? 1 : value;
}

function fixColumn(value: number | null): number | undefined {
	return value === null ? undefined : value === 0 ? 1 : value + 1;
}

export function getRuleNameFromRuleId(ruleId: string): string {
	const parts = ruleId.split('-rule-');
	return parts[parts.length - 1];
}

export function prettyPrintLintResult(result: SecretLintFinding): string {
	const text = result.message;
	const titleColor = result.level === "error" ? chalk.bold.red : chalk.bold.yellow;
	const title = text.length > 54 ? text.slice(0, 50) + '...' : text;
	const ruleName = getRuleNameFromRuleId(result.ruleId);

	let output = `\t${titleColor(title)} [${ruleName}]\n`;
	output += `\t${prettyPrintLocation(result)}\n`;
	return output;
}

function prettyPrintLocation(result: SecretLintFinding): string {
	let output = result.filePath;
	const regionStringified = prettyPrintRegion(result);
	if (regionStringified) {
		output += `#${regionStringified}`;
	}

	return output;
}

function prettyPrintRegion(result: SecretLintFinding): string | undefined {
	const startPosition = prettyPrintPosition(result.startLine, result.startColumn);
	const endPosition = prettyPrintPosition(result.endLine, result.endColumn);

	if (!startPosition) {
		return undefined;
	}

	let output = startPosition;
	if (endPosition && startPosition !== endPosition) {
		output += `-${endPosition}`;
	}

	return output;
}

function prettyPrintPosition(line: number | undefined, column: number | undefined): string | undefined {
	if (line === undefined) {
		return undefined;
	}
	let output: string = line.toString();
	if (column !== undefined) {
		output += `:${column}`;
	}

	return output;
}