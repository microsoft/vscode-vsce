import * as semver from 'semver';
import parseSemver from 'parse-semver';

const nameRegex = /^[a-z0-9][a-z0-9\-]*$/i;

export function validatePublisher(publisher: string | undefined): string {
	if (!publisher) {
		throw new Error(
			`Missing extension "publisher": "<ID>" in package.json. Learn more: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#create-a-publisher`
		);
	}

	if (!nameRegex.test(publisher)) {
		throw new Error(
			`Invalid extension "publisher": "${publisher}" in package.json. Expected the identifier of a publisher, not its human-friendly name. Learn more: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#create-a-publisher`
		);
	}

	return publisher;
}

export function validateExtensionName(name: string | undefined): string {
	if (!name) {
		throw new Error(`Missing extension "name": "<name>" in package.json. Learn more: https://code.visualstudio.com/api/references/extension-manifest`);
	}

	if (!nameRegex.test(name)) {
		throw new Error(`Invalid extension "name": "${name}" in package.json. Learn more: https://code.visualstudio.com/api/references/extension-manifest`);
	}

	return name;
}

export function validateVersion(version: string | undefined): string {
	if (!version) {
		throw new Error(`Missing extension "version": "<version>" in package.json. Learn more: https://code.visualstudio.com/api/references/extension-manifest`);
	}

	if (!semver.valid(version)) {
		throw new Error(`Invalid extension "version": "${version}" in package.json. Learn more:	https://code.visualstudio.com/api/references/extension-manifest`);
	}

	return version;
}

export function validateEngineCompatibility(version: string | undefined): string {
	if (!version) {
		throw new Error(`Missing vscode engine compatibility version. ("engines": { "vscode": "<version>" } in package.json) Learn more: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#visual-studio-code-compatibility`);
	}

	if (!/^\*$|^(\^|>=)?((\d+)|x)\.((\d+)|x)\.((\d+)|x)(\-.*)?$/.test(version)) {
		throw new Error(`Invalid vscode engine compatibility version '${version}'. ("engines": { "vscode": "${version}" } in package.json) Learn more: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#visual-studio-code-compatibility`);
	}

	return version;
}

/**
 * User shouldn't use a newer version of @types/vscode than the one specified in engines.vscode
 *
 * NOTE: This is enforced at the major and minor level. Since we don't have control over the patch
 * version (it's auto-incremented by DefinitelyTyped), we don't look at the patch version at all.
 */
export function validateVSCodeTypesCompatibility(engineVersion: string, typeVersion: string): void {
	if (engineVersion === '*') {
		return;
	}

	if (!typeVersion) {
		throw new Error(`Missing @types/vscode version`);
	}

	let plainEngineVersion: string, plainTypeVersion: string;

	try {
		const engineSemver = parseSemver(`vscode@${engineVersion}`);
		plainEngineVersion = engineSemver.version;
	} catch (err) {
		throw new Error('Failed to parse semver of engines.vscode');
	}

	try {
		const typeSemver = parseSemver(`@types/vscode@${typeVersion}`);
		plainTypeVersion = typeSemver.version;
	} catch (err) {
		throw new Error('Failed to parse semver of @types/vscode');
	}

	// For all `x`, use smallest version for comparison
	plainEngineVersion = plainEngineVersion.replace(/x/g, '0');

	const [typeMajor, typeMinor] = plainTypeVersion.split('.').map(x => {
		try {
			return parseInt(x);
		} catch (err) {
			return 0;
		}
	});
	const [engineMajor, engineMinor] = plainEngineVersion.split('.').map(x => {
		try {
			return parseInt(x);
		} catch (err) {
			return 0;
		}
	});

	const error = new Error(
		`@types/vscode ${typeVersion} greater than engines.vscode ${engineVersion}. Either upgrade engines.vscode or use an older @types/vscode version`
	);

	if (typeMajor > engineMajor) {
		throw error;
	}
	if (typeMajor === engineMajor && typeMinor > engineMinor) {
		throw error;
	}
}
