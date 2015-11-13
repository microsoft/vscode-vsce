import * as fs from 'fs';
import { ExtensionQueryFlags, PublishedExtension, ExtensionQueryFilterType, PagingDirection } from 'vso-node-api/interfaces/GalleryInterfaces';
import { pack, readManifest } from './package';
import * as tmp from 'tmp';
import { getPublisher } from './store';
import { getGalleryAPI, getRawGalleryAPI, read } from './util';
import { validatePublisher } from './validation';
import { Manifest } from './manifest';
import * as denodeify from 'denodeify';

const tmpName = denodeify<string>(tmp.tmpName);
const readFile = denodeify<string, string, string>(fs.readFile);

const galleryUrl = 'https://marketplace.visualstudio.com';

export function publish(cwd = process.cwd()): Promise<any> {
	return tmpName()
		.then(packagePath => pack({ packagePath, cwd }))
		.then(result => {
			const { manifest, packagePath } = result;
			
			return getPublisher(manifest.publisher)
				.then(p => p.pat)
				.then(getGalleryAPI)
				.then(api => {
					return readFile(packagePath, 'base64').then(extensionManifest => {
						const fullName = `${ manifest.publisher}.${ manifest.name }@${ manifest.version }`;
						console.log(`Publishing ${ fullName }...`);
						
						return api.getExtension(manifest.publisher, manifest.name, null, ExtensionQueryFlags.IncludeVersions)
							.catch<PublishedExtension>(err => err.statusCode === 404 ? null : Promise.reject(err))
							.then(extension => {
								if (extension && extension.versions.some(v => v.version === manifest.version)) {
									return Promise.reject(`${ fullName } already exists.`);
								}
								
								var promise = extension
									? api.updateExtension({ extensionManifest }, manifest.publisher, manifest.name)
									: api.createExtension({ extensionManifest });
								
								return promise
									.catch(err => Promise.reject(err.statusCode === 409 ? `${ fullName } already exists.` : err))
									.then(() => console.log(`Successfully published ${ fullName }!`));
							});
						});
				});
		});
}

export function list(publisher: string): Promise<any> {
	validatePublisher(publisher);
	
	return getPublisher(publisher)
		.then(p => p.pat)
		.then(getGalleryAPI)
		.then(api => {
			const criteira = [{ filterType: ExtensionQueryFilterType.Tag, value: 'vscode' }];
			const filters = [{ criteria: criteira, direction: PagingDirection.Backward, pageSize: 1000, pagingToken: null }];
			const query = { filters, flags: ExtensionQueryFlags.IncludeVersions };
			
			return api.queryExtensions(query).then(result => {
				return result.results[0].extensions
					.filter(e => e.publisher.publisherName === publisher)
					.forEach(e => console.log(`${ e.extensionName } @ ${ e.versions[0].version }`));
			});
		});
}

export function unpublish(publisher?: string, name?: string, cwd = process.cwd()): Promise<any> {
	const details = publisher && name
		? Promise.resolve(({ publisher, name }))
		: readManifest(cwd);
	
	return details.then(({ publisher, name }) => {
		const fullName = `${ publisher }.${ name }`;
		
		return read(`This will FOREVER delete '${ fullName }'! Are you sure? [y/N] `)
			.then(answer => /^y$/i.test(answer) ? null : Promise.reject('Aborted'))
			.then(() => getPublisher(publisher))
			.then(p => p.pat)
			.then(getRawGalleryAPI)
			.then(api => {
				const deleteExtension = denodeify<string, string, string, void>(api.deleteExtension.bind(api));
				return deleteExtension(publisher, name, '');
			})
			.then(() => console.log(`Successfully deleted ${ fullName }!`));
	});
}
