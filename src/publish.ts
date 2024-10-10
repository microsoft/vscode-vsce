import * as fs from 'fs';
import { promisify } from 'util';
import * as semver from 'semver';
import { ExtensionQueryFlags, PublishedExtension } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { pack, readManifest, versionBump, prepublish, signPackage, createSignatureArchive } from './package';
import * as tmp from 'tmp';
import { IVerifyPatOptions, getPublisher } from './store';
import { getGalleryAPI, read, getPublishedUrl, log, getHubUrl, patchOptionsWithManifest } from './util';
import { ManifestPackage, ManifestPublish } from './manifest';
import { readVSIXPackage } from './zip';
import { validatePublisher } from './validation';
import { GalleryApi } from 'azure-devops-node-api/GalleryApi';
import FormData from 'form-data';
import { basename } from 'path';
import { IterableBackoff, handleWhen, retry } from 'cockatiel';
import { getAzureCredentialAccessToken } from './auth';

const tmpName = promisify(tmp.tmpName);

/**
 * Options for the `publish` function.
 * @public
 */
export interface IPublishOptions {
	readonly packagePath?: string[];
	readonly version?: string;
	readonly targets?: string[];
	readonly ignoreOtherTargetFolders?: boolean;
	readonly commitMessage?: string;
	readonly gitTagVersion?: boolean;
	readonly updatePackageJson?: boolean;

	/**
	 * The location of the extension in the file system.
	 *
	 * Defaults to `process.cwd()`.
	 */
	readonly cwd?: string;
	readonly readmePath?: string;
	readonly changelogPath?: string;
	readonly githubBranch?: string;
	readonly gitlabBranch?: string;

	/**
	 * The base URL for links detected in Markdown files.
	 */
	readonly baseContentUrl?: string;

	/**
	 * The base URL for images detected in Markdown files.
	 */
	readonly baseImagesUrl?: string;

	/**
	 * Should use Yarn instead of NPM.
	 */
	readonly useYarn?: boolean;
	readonly dependencyEntryPoints?: string[];
	readonly ignoreFile?: string;

	/**
	 * Recurse into symlinked directories instead of treating them as files
	 */
	readonly followSymlinks?: boolean;

	/**
	 * The Personal Access Token to use.
	 *
	 * Defaults to the stored one.
	 */
	readonly pat?: string;
	readonly azureCredential?: boolean;
	readonly allowProposedApi?: boolean;
	readonly noVerify?: boolean;
	readonly allowProposedApis?: string[];
	readonly allowAllProposedApis?: boolean;
	readonly dependencies?: boolean;
	readonly preRelease?: boolean;
	readonly allowStarActivation?: boolean;
	readonly allowMissingRepository?: boolean;
	readonly allowUnusedFilesPattern?: boolean;
	readonly skipDuplicate?: boolean;
	readonly skipLicense?: boolean;

	readonly sigzipPath?: string[];
	readonly manifestPath?: string[];
	readonly signaturePath?: string[];
	readonly signTool?: string;
}

export async function publish(options: IPublishOptions = {}): Promise<any> {
	if (options.packagePath) {
		if (options.version) {
			throw new Error(`Both options not supported simultaneously: 'packagePath' and 'version'.`);
		} else if (options.targets) {
			throw new Error(
				`Both options not supported simultaneously: 'packagePath' and 'target'. Use 'vsce package --target <target>' to first create a platform specific package, then use 'vsce publish --packagePath <path>' to publish it.`
			);
		}

		if (options.manifestPath || options.signaturePath) {
			if (options.packagePath.length !== options.manifestPath?.length || options.packagePath.length !== options.signaturePath?.length) {
				throw new Error(`Either all packages must be signed or none of them.`);
			}
		}

		for (let index = 0; index < options.packagePath.length; index++) {
			const packagePath = options.packagePath[index];
			const vsix = await readVSIXPackage(packagePath);
			let target: string | undefined;

			try {
				target = vsix.xmlManifest.PackageManifest.Metadata[0].Identity[0].$.TargetPlatform ?? undefined;
			} catch (err) {
				throw new Error(`Invalid extension VSIX manifest. ${err}`);
			}

			if (options.preRelease) {
				let isPreReleasePackage = false;
				try {
					isPreReleasePackage = !!vsix.xmlManifest.PackageManifest.Metadata[0].Properties[0].Property.some(
						p => p.$.Id === 'Microsoft.VisualStudio.Code.PreRelease'
					);
				} catch (err) {
					throw new Error(`Invalid extension VSIX manifest. ${err}`);
				}
				if (!isPreReleasePackage) {
					throw new Error(
						`Cannot use '--pre-release' flag with a package that was not packaged as pre-release. Please package it using the '--pre-release' flag and publish again.`
					);
				}
			}

			const manifestValidated = validateManifestForPublishing(vsix.manifest, options);

			let sigzipPath: string | undefined;
			if (options.manifestPath?.[index] && options.signaturePath?.[index]) {
				sigzipPath = await createSignatureArchive(options.manifestPath[index], options.signaturePath[index]);
			}

			if (!sigzipPath) {
				sigzipPath = options.sigzipPath?.[index];
			}

			if (!sigzipPath && options.signTool) {
				sigzipPath = await signPackage(packagePath, options.signTool);
			}

			await _publish(packagePath, sigzipPath, manifestValidated, { ...options, target });
		}
	} else {
		const cwd = options.cwd || process.cwd();
		const manifest = await readManifest(cwd);
		patchOptionsWithManifest(options, manifest);

		// Validate marketplace requirements before prepublish to avoid unnecessary work
		validateManifestForPublishing(manifest, options);

		await prepublish(cwd, manifest, options.useYarn);
		await versionBump(options);

		if (options.targets) {
			for (const target of options.targets) {
				const packagePath = await tmpName();
				const packageResult = await pack({ ...options, target, packagePath });
				const manifestValidated = validateManifestForPublishing(packageResult.manifest, options);
				const sigzipPath = options.signTool ? await signPackage(packagePath, options.signTool) : undefined;
				await _publish(packagePath, sigzipPath, manifestValidated, { ...options, target });
			}
		} else {
			const packagePath = await tmpName();
			const packageResult = await pack({ ...options, packagePath });
			const manifestValidated = validateManifestForPublishing(packageResult.manifest, options);
			const sigzipPath = options.signTool ? await signPackage(packagePath, options.signTool) : undefined;
			await _publish(packagePath, sigzipPath, manifestValidated, options);
		}
	}
}

export interface IInternalPublishOptions {
	readonly target?: string;
	readonly pat?: string;
	readonly allowProposedApi?: boolean;
	readonly noVerify?: boolean;
	readonly allowProposedApis?: string[];
	readonly allowAllProposedApis?: boolean;
	readonly skipDuplicate?: boolean;
}

async function _publish(packagePath: string, sigzipPath: string | undefined, manifest: ManifestPublish, options: IInternalPublishOptions) {
	const pat = await getPAT(manifest.publisher, options);
	const api = await getGalleryAPI(pat);
	const packageStream = fs.createReadStream(packagePath);
	const name = `${manifest.publisher}.${manifest.name}`;
	const description = options.target
		? `${name} (${options.target}) v${manifest.version}`
		: `${name} v${manifest.version}`;

	log.info(`Publishing '${description}'...`);

	let extension: PublishedExtension | null = null;

	try {
		try {
			extension = await api.getExtension(
				null,
				manifest.publisher,
				manifest.name,
				undefined,
				ExtensionQueryFlags.IncludeVersions
			);
		} catch (err: any) {
			if (err.statusCode !== 404) {
				throw err;
			}
		}

		if (extension && extension.versions) {
			const versionExists = extension.versions.some(v =>
				(v.version === manifest.version) &&
				(v.targetPlatform === options.target));

			if (versionExists) {
				if (options.skipDuplicate) {
					log.done(`Version ${manifest.version} is already published. Skipping publish.`);
					return;
				} else {
					throw new Error(`${description} already exists.`);
				}

			}

			if (sigzipPath) {
				await _publishSignedPackage(api, basename(packagePath), packageStream, basename(sigzipPath), fs.createReadStream(sigzipPath), manifest);
			} else {
				try {
					await api.updateExtension(undefined, packageStream, manifest.publisher, manifest.name);
				} catch (err: any) {
					if (err.statusCode === 409) {
						if (options.skipDuplicate) {
							log.done(`Version ${manifest.version} is already published. Skipping publish.`);
							return;
						} else {
							throw new Error(`${description} already exists.`);
						}
					} else {
						throw err;
					}
				}
			}
		} else {
			if (sigzipPath) {
				await _publishSignedPackage(api, basename(packagePath), packageStream, basename(sigzipPath), fs.createReadStream(sigzipPath), manifest);
			} else {
				await api.createExtension(undefined, packageStream);
			}
		}
	} catch (err: any) {
		const message = (err && err.message) || '';

		if (/Personal Access Token used has expired/.test(message)) {
			err.message = `${err.message}\n\nYou're using an expired Personal Access Token, please get a new PAT.\nMore info: https://aka.ms/vscodepat`;
		} else if (/Invalid Resource/.test(message)) {
			err.message = `${err.message}\n\nYou're likely using an expired Personal Access Token, please get a new PAT.\nMore info: https://aka.ms/vscodepat`;
		}

		throw err;
	}

	log.info(`Extension URL (might take a few minutes): ${getPublishedUrl(name)}`);
	log.info(`Hub URL: ${getHubUrl(manifest.publisher, manifest.name)}`);
	log.done(`Published ${description}.`);
}

async function _publishSignedPackage(api: GalleryApi, packageName: string, packageStream: fs.ReadStream, sigzipName: string, sigzipStream: fs.ReadStream, manifest: ManifestPublish) {
	const extensionType = 'Visual Studio Code';
	const form = new FormData();
	const lineBreak = '\r\n';
	form.setBoundary('0f411892-ef48-488f-89d3-4f0546e84723');
	form.append('vsix', packageStream, {
		header: `--${form.getBoundary()}${lineBreak}Content-Disposition: attachment; name=vsix; filename=\"${packageName}\"${lineBreak}Content-Type: application/octet-stream${lineBreak}${lineBreak}`
	});
	form.append('sigzip', sigzipStream, {
		header: `--${form.getBoundary()}${lineBreak}Content-Disposition: attachment; name=sigzip; filename=\"${sigzipName}\"${lineBreak}Content-Type: application/octet-stream${lineBreak}${lineBreak}`
	});

	const publishWithRetry = retry(handleWhen(err => err.message.includes('timeout')), {
		maxAttempts: 3,
		backoff: new IterableBackoff([5_000, 10_000, 20_000])
	});

	return await publishWithRetry.execute(async () => {
		return await api.publishExtensionWithPublisherSignature(undefined, form, manifest.publisher, manifest.name, extensionType);
	});
}

/**
 * Options for the `unpublish` function.
 * @public
 */
export interface IUnpublishOptions extends IPublishOptions {
	id?: string;
	force?: boolean;
}

export async function unpublish(options: IUnpublishOptions = {}): Promise<any> {
	let publisher: string, name: string;

	if (options.id) {
		[publisher, name] = options.id.split('.');
	} else {
		const manifest = await readManifest(options.cwd);
		publisher = validatePublisher(manifest.publisher);
		name = manifest.name;
	}

	const fullName = `${publisher}.${name}`;

	if (!options.force) {
		const answer = await read(`This will delete ALL published versions! Please type '${fullName}' to confirm: `);

		if (answer !== fullName) {
			throw new Error('Aborted');
		}
	}

	const pat = await getPAT(publisher, options);
	const api = await getGalleryAPI(pat);

	await api.deleteExtension(publisher, name);
	log.done(`Deleted extension: ${fullName}!`);
}

function validateManifestForPublishing(manifest: ManifestPackage, options: IInternalPublishOptions): ManifestPublish {
	if (manifest.enableProposedApi && !options.allowAllProposedApis && !options.noVerify) {
		throw new Error(
			"Extensions using proposed API (enableProposedApi: true) can't be published to the Marketplace. Use --allow-all-proposed-apis to bypass. https://code.visualstudio.com/api/advanced-topics/using-proposed-api"
		);
	}

	if (manifest.enabledApiProposals && !options.allowAllProposedApis && !options.noVerify && manifest.enabledApiProposals?.some(p => !options.allowProposedApis?.includes(p))) {
		throw new Error(
			`Extensions using unallowed proposed API (enabledApiProposals: [${manifest.enabledApiProposals}], allowed: [${options.allowProposedApis ?? []}]) can't be published to the Marketplace. Use --allow-proposed-apis <APIS...> or --allow-all-proposed-apis to bypass. https://code.visualstudio.com/api/advanced-topics/using-proposed-api`
		);
	}

	if (semver.prerelease(manifest.version)) {
		throw new Error(`The VS Marketplace doesn't support prerelease versions: '${manifest.version}'. Checkout our pre-release versioning recommendation here: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions`);
	}

	return { ...manifest, publisher: validatePublisher(manifest.publisher) };
}

export async function getPAT(publisher: string, options: IPublishOptions | IUnpublishOptions | IVerifyPatOptions): Promise<string> {
	if (options.pat) {
		return options.pat;
	}

	if (options.azureCredential) {
		return await getAzureCredentialAccessToken();
	}

	return (await getPublisher(publisher)).pat;
}
