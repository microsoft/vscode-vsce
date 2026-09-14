import * as semver from 'semver';

export interface PackageSpec {
	name: string;
	range: string;
	version: string;
}

export function parsePackageSpec(value: string): PackageSpec {
	const separator = value.indexOf('@', value.startsWith('@') ? 1 : 0);
	const name = separator === -1 ? value : value.slice(0, separator);
	const originalVersion = separator === -1 ? '' : value.slice(separator + 1);
	const range = semver.validRange(originalVersion);

	if (originalVersion && !range) {
		throw new Error(`Invalid semver range: ${originalVersion}`);
	}

	const version = originalVersion.replace(/^[^0-9]+/, '') || 'latest';
	return { name, range: range ?? '*', version };
}
