import chalk from "chalk";
import { Convert, Location, Region, Result, Level } from "./typings/secret-lint-types";

interface SecretLintEngineResult {
	ok: boolean;
	output: string;
}

interface SecretLintResult {
	ok: boolean;
	results: Result[];
}

const lintConfig = {
	rules: [
		{
			id: "@secretlint/secretlint-rule-preset-recommend",
			rules: [
				{
					"id": "@secretlint/secretlint-rule-basicauth",
					"allowMessageIds": ["BasicAuth"]
				}
			]
		}, {
			id: "@secretlint/secretlint-rule-no-dotenv"
		}

	]
};

const lintOptions = {
	configFileJSON: lintConfig,
	formatter: "@secretlint/secretlint-formatter-sarif", // checkstyle, compact, jslint-xml, junit, pretty-error, stylish, tap, unix, json, mask-result, table
	color: true,
	maskSecrets: false
};

// Helper function to dynamically import the createEngine function
async function getEngine() {
	// Use a raw dynamic import that will not be transformed
	// This is necessary because @secretlint/node is an ESM module
	const secretlintModule = await eval('import("@secretlint/node")');
	const engine = await secretlintModule.createEngine(lintOptions);
	return engine;
}

export async function lintFiles(
	filePaths: string[]
): Promise<SecretLintResult> {
	const engine = await getEngine();

	const engineResult = await engine.executeOnFiles({
		filePathList: filePaths
	});
	return parseResult(engineResult);
}

export async function lintText(
	content: string,
	fileName: string
): Promise<SecretLintResult> {
	const engine = await getEngine();

	const engineResult = await engine.executeOnContent({
		content,
		filePath: fileName
	});
	return parseResult(engineResult);
}

function parseResult(result: SecretLintEngineResult): SecretLintResult {
	const output = Convert.toSecretLintOutput(result.output);
	const results = output.runs.at(0)?.results ?? [];
	return { ok: result.ok, results };
}

export function getRuleNameFromRuleId(ruleId: string): string {
	const parts = ruleId.split('-rule-');
	return parts[parts.length - 1];
}

export function prettyPrintLintResult(result: Result): string {
	if (!result.message.text) {
		return JSON.stringify(result);
	}

	const text = result.message.text;
	const titleColor = result.level === undefined || result.level === Level.Error ? chalk.bold.red : chalk.bold.yellow;
	const title = text.length > 54 ? text.slice(0, 50) + '...' : text;
	const ruleName = result.ruleId ? getRuleNameFromRuleId(result.ruleId) : 'unknown';

	let output = `\t${titleColor(title)} [${ruleName}]\n`;

	if (result.locations) {
		result.locations.forEach(location => {
			output += `\t${prettyPrintLocation(location)}\n`;
		});
	}
	return output;
}

function prettyPrintLocation(location: Location): string {
	if (!location.physicalLocation) { return JSON.stringify(location); }

	const uri = location.physicalLocation.artifactLocation?.uri;
	if (!uri) { return JSON.stringify(location); }

	let output = uri;

	const region = location.physicalLocation.region;
	const regionStringified = region ? prettyPrintRegion(region) : undefined;
	if (regionStringified) {
		output += `#${regionStringified}`;
	}

	return output;
}

function prettyPrintRegion(region: Region): string | undefined {
	const startPosition = prettyPrintPosition(region.startLine, region.startColumn);
	const endPosition = prettyPrintPosition(region.endLine, region.endColumn);

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