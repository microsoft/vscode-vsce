import * as fs from 'fs';
import { ExtensionQueryFlags, PublishedExtension } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { pack, readManifest, versionBump } from './package';
import * as tmp from 'tmp';
import { getPublisher } from './store';
import { getGalleryAPI, read, getPublishedUrl, log, getHubUrl } from './util';
import { Manifest } from './manifest';
import * as denodeify from 'denodeify';
import { readVSIXPackage } from './zip';

const tmpName = denodeify<string>(tmp.tmpName);

export interface IPublishOptions {
	readonly packagePath?: string[];
	readonly version?: string;
	readonly target?: string;
	readonly commitMessage?: string;
	readonly gitTagVersion?: boolean;
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
}

export async function publish(options: IPublishOptions = {}): Promise<any> {
	if (options.packagePath) {
		if (options.version) {
			throw new Error(`Both options not supported simultaneously: 'packagePath' and 'version'.`);
		} else if (options.target) {
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
		await versionBump(options.cwd, options.version, options.commitMessage, options.gitTagVersion);

		const packagePath = await tmpName();
		const packageResult = await pack({ ...options, packagePath });
		await _publish(packagePath, packageResult.manifest, options);
	}
}

async function _publish(packagePath: string, manifest: Manifest, options: IPublishOptions) {
	if (!options.noVerify && manifest.enableProposedApi) {
		throw new Error("Extensions using proposed API (enableProposedApi: true) can't be published to the Marketplace");
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
				null,
				ExtensionQueryFlags.IncludeVersions
			);
		} catch (err) {
			if (err.statusCode !== 404) {
				throw err;
			}
		}

		if (!options.target && extension && extension.versions.some(v => v.version === manifest.version)) {
			throw new Error(`${description} already exists. Version number cannot be the same.`);
		}

		if (extension) {
			try {
				await api.updateExtension(undefined, packageStream, manifest.publisher, manifest.name);
			} catch (err) {
				if (err.statusCode === 409) {
					throw new Error(`${description} already exists.`);
				} else {
					throw err;
				}
			}
		} else {
			await api.createExtension(undefined, packageStream);
		}
	} catch (err) {
		const message = (err && err.message) || '';

		if (/Invalid Resource/.test(message)) {
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

export async function unpublish(options: IUnpublishOptions = {}): Promise<any> {
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
		const answer = await read(`This will FOREVER delete '${fullName}'! Are you sure? [y/N] `);

		if (!/^y$/i.test(answer)) {
			throw new Error('Aborted');
		}
	}

	const pat = options.pat ?? (await getPublisher(publisher)).pat;
	const api = await getGalleryAPI(pat);

	await api.deleteExtension(publisher, name);
	log.done(`Deleted extension: ${fullName}!`);
}
