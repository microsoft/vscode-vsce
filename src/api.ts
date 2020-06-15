import { publish as _publish } from './publish';
import { packageCommand, listFiles as _listFiles } from './package';

export interface ICreateVSIXOptions {
	/**
	 * The location of the extension in the file system.
	 *
	 * Defaults to `process.cwd()`.
	 */
	cwd?: string;

	/**
	 * The destination of the packaged the VSIX.
	 *
	 * Defaults to `NAME-VERSION.vsix`.
	 */
	packagePath?: string;

	/**
	 * The base URL for links detected in Markdown files.
	 */
	baseContentUrl?: string;

	/**
	 * The base URL for images detected in Markdown files.
	 */
	baseImagesUrl?: string;

	/**
	 * Should use Yarn instead of NPM.
	 */
	useYarn?: boolean;
}

export interface IPublishOptions {

	/**
	 * The location of the extension in the file system.
	 *
	 * Defaults to `process.cwd()`.
	 */
	cwd?: string;

	/**
	 * The Personal Access Token to use.
	 *
	 * Defaults to the stored one.
	 */
	pat?: string;

	/**
	 * The base URL for links detected in Markdown files.
	 */
	baseContentUrl?: string;

	/**
	 * The base URL for images detected in Markdown files.
	 */
	baseImagesUrl?: string;

	/**
	 * Should use Yarn instead of NPM.
	 */
	useYarn?: boolean;
}

/**
 * The supported list of package managers.
 */
export enum PackageManager {
	Npm,
	Yarn
}

export interface IListFilesOptions {

	/**
	 * The working directory of the extension. Defaults to `process.cwd()`.
	 */
	cwd?: string;

	/**
	 * The package manager to use. Defaults to `PackageManager.Npm`.
	 */
	packageManager?: PackageManager;

	/**
	 * A subset of the top level dependencies which should be included. The 
	 * default is `undefined` which include all dependencies, an empty array means
	 * no dependencies will be included.
	 */
	packagedDependencies?: string[];

	/**
	 * The location of an alternative .vscodeignore file to be used.
	 * The `.vscodeignore` file located at the root of the project will be taken
	 * instead, if none is specified.
	 */
	ignoreFile?: string;
}

export interface IPublishVSIXOptions {

	/**
	 * The Personal Access Token to use.
	 *
	 * Defaults to the stored one.
	 */
	pat?: string;

	/**
	 * The base URL for links detected in Markdown files.
	 */
	baseContentUrl?: string;

	/**
	 * The base URL for images detected in Markdown files.
	 */
	baseImagesUrl?: string;

	/**
	 * Should use Yarn instead of NPM.
	 */
	useYarn?: boolean;
}

/**
 * Creates a VSIX from the extension in the current working directory.
 */
export function createVSIX(options: ICreateVSIXOptions = {}): Promise<any> {
	return packageCommand(options);
}

/**
 * Publishes the extension in the current working directory.
 */
export function publish(options: IPublishOptions = {}): Promise<any> {
	return _publish(options);
}

/**
 * Lists the files included in the extension's package.
 */
export function listFiles(options: IListFilesOptions = {}): Promise<string[]> {
	return _listFiles(options.cwd, options.packageManager === PackageManager.Yarn, options.packagedDependencies, options.ignoreFile);
}

/**
 * Publishes a pre-build VSIX.
 */
export function publishVSIX(packagePath: string, options: IPublishVSIXOptions = {}): Promise<any> {
	return _publish({ packagePath, ...options });
}
