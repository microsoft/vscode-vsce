import * as fs from 'fs';
import { ExtensionQueryFlags, PublishedExtension } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { pack, readManifest, versionBump, IPackageOptions } from './package';
import * as tmp from 'tmp';
import { getPublisher } from './store';
import { getGalleryAPI, read, getPublishedUrl, log, getHubUrl } from './util';
import { Manifest } from './manifest';
import * as denodeify from 'denodeify';
import * as yauzl from 'yauzl';

const tmpName = denodeify<string>(tmp.tmpName);

function readManifestFromPackage(packagePath: string): Promise<Manifest> {
	return new Promise<Manifest>((c, e) => {
		yauzl.open(packagePath, (err, zipfile) => {
			if (err) {
				return e(err);
			}

			const onEnd = () => e(new Error('Manifest not found'));
			zipfile.once('end', onEnd);

			zipfile.on('entry', entry => {
				if (!/^extension\/package\.json$/i.test(entry.fileName)) {
					return;
				}

				zipfile.removeListener('end', onEnd);

				zipfile.openReadStream(entry, (err, stream) => {
					if (err) {
						return e(err);
					}

					const buffers = [];
					stream.on('data', buffer => buffers.push(buffer));
					stream.once('error', e);
					stream.once('end', () => {
						try {
							c(JSON.parse(Buffer.concat(buffers).toString('utf8')));
						} catch (err) {
							e(err);
						}
					});
				});
			});
		});
	});
}

export interface IPublishOptions extends IPackageOptions {
	readonly pat?: string;
	readonly noVerify?: boolean;
}

export async function publish(options: IPublishOptions = {}): Promise<any> {
	let packagePath: string;
	let manifest: Manifest;

	if (options.packagePath) {
		if (options.version) {
			return Promise.reject(`Both options not supported simultaneously: packagePath and version.`);
		}

		packagePath = options.packagePath;
		manifest = await readManifestFromPackage(options.packagePath);
	} else {
		await versionBump(options.cwd, options.version, options.commitMessage, options.gitTagVersion);

		packagePath = await tmpName();
		manifest = (await pack({ ...options, packagePath })).manifest;
	}

	if (!options.noVerify && manifest.enableProposedApi) {
		throw new Error("Extensions using proposed API (enableProposedApi: true) can't be published to the Marketplace");
	}

	const pat = options.pat ?? (await getPublisher(manifest.publisher)).pat;
	const api = await getGalleryAPI(pat);
	const packageStream = fs.createReadStream(packagePath);
	const name = `${manifest.publisher}.${manifest.name}`;
	const description = options.target ? `${name}-${options.target}@${manifest.version}` : `${name}@${manifest.version}`;

	console.log(`Publishing '${description}'...`);

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
