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
export interface IPackageManager {
	/**
	 * The binary name of the package manager.
	 * @example 'yarn' | 'npm' | 'bun'
	 */
	binaryName: string;

	/**
	 * Get the version of the package manager itself.
	 */
	selfVersion(cancellationToken?: CancellationToken): Promise<string>;

	/**
	 * Check if the package manager version and configs are compatible.
	 */
	selfCheck(cancellationToken?: CancellationToken): Promise<void>;

	/**
	 * Get the command to run a script.
	 */
	commandRun(scriptName: string): string;

	/**
	 * Get the command to install a package.
	 */
	commandInstall(packageName: string, global: boolean): string;

	/**
	 * Request the latest version of a package from the registry.
	 */
	pkgRequestLatest(name: string, cancellationToken?: CancellationToken): Promise<string>;

	/**
	 * Get the production dependencies of a package.
	 */
	pkgProdDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]>;

	/**
	 * Get the files of production dependencies of a package.
	 * Should use pkgProdDependencies first to get the dependencies.
	 */
	pkgProdDependenciesFiles(cwd: string, deps: string[], followSymlinks?: boolean): Promise<string[]>;
}

/**
 * Get package manager by preference.
 * @returns Package manager implementation.
 */
export function getPackageManager(
	preference: PackageManagerLiteral = "npm",
): IPackageManager {
	const choice = {
		"none": pmNone,
		"npm": pmNPM,
		"yarn": pmYarn,
	} as Record<PackageManagerLiteral, IPackageManager>

	return choice[preference]
}
