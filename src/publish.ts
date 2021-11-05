import * as fs from 'fs';
import { promisify } from 'util';
import * as semver from 'semver';
import {
	ExtensionQueryFlags,
	PublishedExtension,
	PublishedExtensionFlags,
} from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { pack, readManifest, versionBump, prepublish } from './package';
import * as tmp from 'tmp';
import { getPublisher } from './store';
import { getGalleryAPI, read, getPublishedUrl, log, getHubUrl } from './util';
import { Manifest } from './manifest';
import { readVSIXPackage } from './zip';

const tmpName = promisify(tmp.tmpName);

export interface IPublishOptions {
	readonly packagePath?: string[];
	readonly version?: string;
	readonly targets?: string[];
	readonly commitMessage?: string;
	readonly gitTagVersion?: boolean;
	readonly updatePackageJson?: boolean;
	readonly cwd?: string;
	readonly githubBranch?: string;
	readonly gitlabBranch?: string;
	readonly baseContentUrl?: string;
	readonly baseImagesUrl?: string;
	readonly useYarn?: boolean;
	readonly dependencyEntryPoints?: string[];
	readonly ignoreFile?: string;
	readonly pat?: string;
	readonly noVerify?: boolean;
	readonly dependencies?: boolean;
}

export async function publish(options: IPublishOptions = {}): Promise<any> {
	if (options.packagePath) {
		if (options.version) {
			throw new Error(`Both options not supported simultaneously: 'packagePath' and 'version'.`);
		} else if (options.targets) {
			throw new Error(`Both options not supported simultaneously: 'packagePath' and 'target'.`);
		}

		for (const packagePath of options.packagePath) {
			const vsix = await readVSIXPackage(packagePath);
			let target: string | undefined;

			try {
				target = vsix.xmlManifest.PackageManifest.Metadata[0].Identity[0].$.TargetPlatform ?? undefined;
			} catch (err) {
				throw new Error(`Invalid extension VSIX manifest. ${err}`);
			}

			await _publish(packagePath, vsix.manifest, { ...options, target });
		}
	} else {
		const cwd = options.cwd || process.cwd();
		const manifest = await readManifest(cwd);
		await prepublish(cwd, manifest, options.useYarn);
		await versionBump(options);

		if (options.targets) {
			for (const target of options.targets) {
				const packagePath = await tmpName();
				const packageResult = await pack({ ...options, target, packagePath });
				await _publish(packagePath, packageResult.manifest, { ...options, target });
			}
		} else {
			const packagePath = await tmpName();
			const packageResult = await pack({ ...options, packagePath });
			await _publish(packagePath, packageResult.manifest, options);
		}
	}
}

export interface IInternalPublishOptions {
	readonly target?: string;
	readonly pat?: string;
	readonly noVerify?: boolean;
}

async function _publish(packagePath: string, manifest: Manifest, options: IInternalPublishOptions) {
	if (!options.noVerify && manifest.enableProposedApi) {
		throw new Error("Extensions using proposed API (enableProposedApi: true) can't be published to the Marketplace");
	}

	if (semver.prerelease(manifest.version)) {
		throw new Error(`The VS Marketplace doesn't support prerelease versions: '${manifest.version}'`);
	}

	const pat = options.pat ?? (await getPublisher(manifest.publisher)).pat;
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
			const sameVersion = extension.versions.filter(v => v.version === manifest.version);

			if (sameVersion.length > 0) {
				if (!options.target) {
					throw new Error(`${description} already exists.`);
				}

				if (sameVersion.some(v => !v.targetPlatform)) {
					throw new Error(`${name} (no target) v${manifest.version} already exists.`);
				}

				if (sameVersion.some(v => v.targetPlatform === options.target)) {
					throw new Error(`${description} already exists.`);
				}
			}

			try {
				await api.updateExtension(undefined, packageStream, manifest.publisher, manifest.name);
			} catch (err: any) {
				if (err.statusCode === 409) {
					throw new Error(`${description} already exists.`);
				} else {
					throw err;
				}
			}
		} else {
			await api.createExtension(undefined, packageStream);
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

export interface IUnpublishOptions extends IPublishOptions {
	id?: string;
	force?: boolean;
}

export async function unpublishExtension(options: IUnpublishOptions = {}): Promise<any> {
	let publisher: string, name: string;

	if (options.id) {
		[publisher, name] = options.id.split('.');
	} else {
		const manifest = await readManifest(options.cwd);
		publisher = manifest.publisher;
		name = manifest.name;
	}

	const fullName = `${publisher}.${name}`;

	if (!options.force) {
		const answer = await read(
			`This will unpublish '${fullName}'. It will still be on the Marketplace but users won't be able to downlaod it. Do you want to continue? [y/N] `
		);

		if (!/^y$/i.test(answer)) {
			throw new Error('Aborted');
		}
	}

	const pat = options.pat ?? (await getPublisher(publisher)).pat;
	const api = await getGalleryAPI(pat);

	await api.updateExtensionProperties(publisher, name, PublishedExtensionFlags.Unpublished);
	log.done(`Unpublished extension: ${fullName}`);
}

export async function deleteExtension(options: IUnpublishOptions = {}): Promise<any> {
	let publisher: string, name: string;

	if (options.id) {
		[publisher, name] = options.id.split('.');
	} else {
		const manifest = await readManifest(options.cwd);
		publisher = manifest.publisher;
		name = manifest.name;
	}

	const fullName = `${publisher}.${name}`;

	if (!options.force) {
		const answer = await read(`This will FOREVER delete '${fullName}'! Do you want to continue? [y/N] `);

		if (!/^y$/i.test(answer)) {
			throw new Error('Aborted');
		}
	}

	const pat = options.pat ?? (await getPublisher(publisher)).pat;
	const api = await getGalleryAPI(pat);

	await api.deleteExtension(publisher, name);
	log.done(`Deleted extension: ${fullName}`);
}
