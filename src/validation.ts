import * as semver from 'semver';

const nameRegex = /^[a-z0-9][a-z0-9\-]*$/i;

export function validatePublisher(publisher: string): void {
	if (!publisher) {
		throw new Error(`Missing publisher name`);
	}

	if (!nameRegex.test(publisher)) {
		throw new Error(`Invalid publisher '${ publisher }'`);
	}
}

export function validateExtensionName(name: string): void {
	if (!name) {
		throw new Error(`Missing extension name`);
	}

	if (!nameRegex.test(name)) {
		throw new Error(`Invalid extension name '${ name }'`);
	}
}

export function validateVersion(version: string): void {
	if (!version) {
		throw new Error(`Missing extension version`);
	}

	if (!semver.valid(version)) {
		throw new Error(`Invalid extension version '${ version }'`);
	}
}