import chalk from "chalk";
import * as path from "path";
import { pathToFileURL } from "url";
import { log } from "./util";

interface SecretLintEngineResult {
	ok: boolean;
	output: string;
}

type SecretLintSeverity = "error" | "warning" | "info";

interface SecretLintPosition {
	line: number | null;
	column: number | null;
}

interface SecretLintMessage {
	message: string;
	ruleId: string;
	ruleParentId?: string;
	loc: {
		start: SecretLintPosition;
		end: SecretLintPosition;
	};
	severity: SecretLintSeverity;
}

interface SecretLintFileResult {
	filePath: string;
	messages: SecretLintMessage[];
}

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

async function getEngine(scanSecrets: boolean, scanDotEnv: boolean) {
	const { createEngine } = require("@secretlint/node") as typeof import("@secretlint/node");

	const rules = [];
	if (scanSecrets) {
		rules.push(...secretsScanningRules);
	}
	if (scanDotEnv) {
		rules.push(...dotEnvRules);
	}

	const lintOptions = {
		configFileJSON: { rules: rules },
		formatter: "json",
		color: true,
		maskSecrets: false
	};

	const engine = await createEngine(lintOptions);
	return engine;
}

export async function lintFiles(
	filePaths: string[],
	scanSecrets: boolean,
	scanDotEnv: boolean
): Promise<SecretLintResult> {
	const engine = await getEngine(scanSecrets, scanDotEnv);

	let engineResult;
	try {
		engineResult = await engine.executeOnFiles({
			filePathList: filePaths
		});
	} catch (error) {
		log.error('Error occurred while scanning secrets (files):', error);
		process.exit(1);
	}

	return parseResult(engineResult);
}

export async function lintText(
	content: string,
	fileName: string,
	scanSecrets: boolean,
	scanDotEnv: boolean
): Promise<SecretLintResult> {
	const engine = await getEngine(scanSecrets, scanDotEnv);

	let engineResult;
	try {
		engineResult = await engine.executeOnContent({
			content,
			filePath: fileName
		});
	} catch (error) {
		log.error('Error occurred while scanning secrets (content):', error);
		process.exit(1);
	}
	return parseResult(engineResult);
}

function parseResult(result: SecretLintEngineResult): SecretLintResult {
	const output: unknown = JSON.parse(result.output);
	if (!Array.isArray(output) || !output.every(isSecretLintFileResult)) {
		throw new Error("Unexpected output from secretlint");
	}

	const results = output.flatMap(fileResult =>
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

	return { ok: result.ok, results };
}

function isSecretLintFileResult(value: unknown): value is SecretLintFileResult {
	return isRecord(value)
		&& typeof value.filePath === "string"
		&& Array.isArray(value.messages)
		&& value.messages.every(isSecretLintMessage);
}

function isSecretLintMessage(value: unknown): value is SecretLintMessage {
	return isRecord(value)
		&& typeof value.message === "string"
		&& typeof value.ruleId === "string"
		&& (value.ruleParentId === undefined || typeof value.ruleParentId === "string")
		&& isRecord(value.loc)
		&& isSecretLintPosition(value.loc.start)
		&& isSecretLintPosition(value.loc.end)
		&& (value.severity === "error" || value.severity === "warning" || value.severity === "info");
}

function isSecretLintPosition(value: unknown): value is SecretLintPosition {
	return isRecord(value)
		&& (value.line === null || typeof value.line === "number")
		&& (value.column === null || typeof value.column === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
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