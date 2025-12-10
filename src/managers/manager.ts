import { CancellationToken } from "../util";

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
