import { publish as _publish, IPublishOptions as _IPublishOptions } from './publish';
import { packageCommand, listFiles as _listFiles, IPackageOptions } from './package';

/**
 * @deprecated prefer IPackageOptions instead
 */
export type IBaseVSIXOptions = Pick<
	IPackageOptions,
	'baseContentUrl' | 'baseImagesUrl' | 'githubBranch' | 'gitlabBranch' | 'useYarn' | 'target' | 'preRelease' | 'version'
>;

/**
 * @deprecated prefer IPackageOptions instead
 */
export type ICreateVSIXOptions = Pick<IPackageOptions, 'cwd' | 'packagePath'> & IBaseVSIXOptions;

/**
 * The supported list of package managers.
 */
export enum PackageManager {
	Npm,
	Yarn,
	None,
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

export type IPublishVSIXOptions = IPublishOptions & Pick<IPackageOptions, 'target'>;

export type IPublishOptions = _IPublishOptions;

/**
 * Creates a VSIX from the extension in the current working directory.
 */
export function createVSIX(options: IPackageOptions = {}): Promise<any> {
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
	return _listFiles(options);
}

/**
 * Publishes a pre-build VSIX.
 */
export function publishVSIX(packagePath: string | string[], options: IPublishVSIXOptions = {}): Promise<any> {
	return _publish({
		packagePath: typeof packagePath === 'string' ? [packagePath] : packagePath,
		...options,
		targets: typeof options.target === 'string' ? [options.target] : undefined,
		...{ target: undefined },
	});
}
