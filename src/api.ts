import { publish as _publish, IPublishOptions, unpublish as _unpublish, IUnpublishOptions } from './publish';
import { packageCommand, listFiles as _listFiles, IPackageOptions } from './package';

/**
 * @deprecated prefer IPackageOptions instead
 * @public
 */
export type IBaseVSIXOptions = Pick<
	IPackageOptions,
	'baseContentUrl' | 'baseImagesUrl' | 'githubBranch' | 'gitlabBranch' | 'useYarn' | 'target' | 'preRelease'
>;

/**
 * @deprecated prefer IPackageOptions instead
 * @public
 */
export type ICreateVSIXOptions = Pick<IPackageOptions, 'cwd' | 'packagePath'> & IBaseVSIXOptions;

/**
 * The supported list of package managers.
 * @public
 */
export enum PackageManager {
	Npm,
	Yarn,
	None,
}

/**
 * Options for the `listFiles` function.
 * @public
 */
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

export type { IPackageOptions } from './package';

/**
 * Creates a VSIX from the extension in the current working directory.
 * @public
 */
export function createVSIX(options: IPackageOptions = {}): Promise<any> {
	return packageCommand(options);
}

export type { IPublishOptions } from './publish';

/**
 * Publishes the extension in the current working directory.
 * @public
 */
export function publish(options: IPublishOptions = {}): Promise<any> {
	return _publish(options);
}

/**
 * Lists the files included in the extension's package.
 * @public
 */
export function listFiles(options: IListFilesOptions = {}): Promise<string[]> {
	return _listFiles({
		...options,
		useYarn: options.packageManager === PackageManager.Yarn,
		dependencies: options.packageManager !== PackageManager.None,
	});
}

/**
 * Options for the `publishVSIX` function.
 * @public
 */
export type IPublishVSIXOptions = IPublishOptions & Pick<IPackageOptions, 'target'>;

/**
 * Publishes a pre-build VSIX.
 * @public
 */
export function publishVSIX(packagePath: string | string[], options: IPublishVSIXOptions = {}): Promise<any> {
	return _publish({
		packagePath: typeof packagePath === 'string' ? [packagePath] : packagePath,
		...options,
		targets: typeof options.target === 'string' ? [options.target] : undefined,
		...{ target: undefined },
	});
}

/**
 * Options for the `unpublishVSIX` function.
 * @public
 */
export type IUnpublishVSIXOptions = IPublishOptions & Pick<IUnpublishOptions, 'id'>;

/**
 * Deletes a specific extension from the marketplace.
 * @public
 */
export function unpublishVSIX(options: IUnpublishVSIXOptions = {}): Promise<any> {
	return _unpublish({ force: true, ...options });
}