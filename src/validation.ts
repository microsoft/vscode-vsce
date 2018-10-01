import * as semver from 'semver';

const nameRegex = /^[a-z0-9][a-z0-9\-]*$/i;

export function validatePublisher(publisher: string): void {
	if (!publisher) {
		throw new Error(`Missing publisher name. Learn more: https://code.visualstudio.com/docs/extensions/publish-extension#_publishing-extensions`);
	}

	if (!nameRegex.test(publisher)) {
		throw new Error(`Invalid publisher name '${publisher}'. Expected the identifier of a publisher, not its human-friendly name.  Learn more: https://code.visualstudio.com/docs/extensions/publish-extension#_publishing-extensions`);
	}
}

export function validateExtensionName(name: string): void {
	if (!name) {
		throw new Error(`Missing extension name`);
	}

	if (!nameRegex.test(name)) {
		throw new Error(`Invalid extension name '${name}'`);
	}
}

export function validateVersion(version: string): void {
	if (!version) {
		throw new Error(`Missing extension version`);
	}

	if (!semver.valid(version)) {
		throw new Error(`Invalid extension version '${version}'`);
	}
}

export function validateEngineCompatibility(version: string): void {
	if (!version) {
		throw new Error(`Missing vscode engine compatibility version`);
	}

	if (!/^\*$|^(\^|>=)?((\d+)|x)\.((\d+)|x)\.((\d+)|x)(\-.*)?$/.test(version)) {
		throw new Error(`Invalid vscode engine compatibility version '${version}'`);
	}
}