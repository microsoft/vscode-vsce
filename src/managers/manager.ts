import { CancellationToken } from "../util";
import { pmNone } from "./none";
import { pmNPM } from "./npm";
import { pmYarn } from "./yarn";

// Reminder: scr/api.ts (PackageManager enum).
const managers = ['none', 'npm', 'yarn'] as const
export const Managers = new Set(managers);
export type PackageManagerLiteral = typeof managers[number];

/**
 * Interface for package manager implementations.
 * Using interface to force explicit implementations.
 */
export abstract class PackageManager {
	/**
	 * The binary name of the package manager.
	 * @example 'yarn' | 'npm' | 'bun'
	 */
	abstract binaryName: string;

	/**
	 * Get the version of the package manager itself.
	 */
	abstract selfVersion(cancellationToken?: CancellationToken): Promise<string>;

	/**
	 * Check if the package manager version and configs are compatible.
	 */
	abstract selfCheck(cancellationToken?: CancellationToken): Promise<void>;

	/**
	 * Get the command to run a script.
	 */
	abstract commandRun(scriptName: string): string;

	/**
	 * Get the command to install a package.
	 */
	abstract commandInstall(packageName: string, global: boolean): string;

	/**
	 * Request the latest version of a package from the registry.
	 */
	abstract pkgRequestLatest(name: string, cancellationToken?: CancellationToken): Promise<string>;

	/**
	 * Get the production dependencies of a package.
	 */
	abstract pkgProdDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]>;

	/**
	 * Get the files of production dependencies of a package.
	 * Should use pkgProdDependencies first to get the dependencies.
	 */
	abstract pkgProdDependenciesFiles(cwd: string, deps: string[], followSymlinks?: boolean): Promise<string[]>;
}

/**
 * Get package manager by preference.
 * @returns Package manager implementation.
 */
export function getPackageManager(
	preference: PackageManagerLiteral = "npm",
): PackageManager {
	const choice = {
		"none": pmNone,
		"npm": pmNPM,
		"yarn": pmYarn,
	} as Record<PackageManagerLiteral, PackageManager>

	return choice[preference]
}

/**
 * Throws only for strings that are not valid package managers.
 * `undefiend` is allowed.
 */
export function assertPackageManager(packageManager: string | undefined): asserts packageManager is PackageManagerLiteral | undefined {
	if (packageManager === undefined) {
		return
	}
	if (!Managers.has(packageManager as PackageManagerLiteral)) {
		throw new Error(`'${packageManager}' is not a supported package manager. Valid managers: ${[...Managers].join(', ')}`);
	}
}
