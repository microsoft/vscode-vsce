import { readFile } from 'fs';
import { ExtensionQueryFlags, PublishedExtension } from 'vso-node-api/interfaces/GalleryInterfaces';
import { nfcall, Promise, reject } from 'q';
import { pack } from './package';
import { tmpName } from 'tmp';
import { getPublisher } from './store';
import { getGalleryAPI } from './util';

const galleryUrl = 'https://app.market.visualstudio.com';

export function publish(cwd = process.cwd()): Promise<any> {
	return nfcall<string>(tmpName)
		.then(packagePath => pack(packagePath, cwd))
		.then(result => {
			const { manifest, packagePath } = result;
			
			return getPublisher(manifest.publisher)
				.then(p => p.pat)
				.then(getGalleryAPI)
				.then(api => {
					return nfcall<string>(readFile, packagePath, 'base64').then(extensionManifest => {
						const fullName = `${ manifest.name }@${ manifest.version }`;
						console.log(`Publishing ${ fullName }...`);
						
						return api.getExtension(manifest.publisher, manifest.name, null, ExtensionQueryFlags.IncludeVersions)
							.catch<PublishedExtension>(err => err.statusCode === 404 ? null : reject(err))
							.then(extension => {
								if (extension && extension.versions.some(v => v.version === manifest.version)) {
									return reject<void>(`${ fullName } already exists.`);
								}
								
								var promise = extension
									? api.updateExtension({ extensionManifest }, manifest.publisher, manifest.name)
									: api.createExtension({ extensionManifest });
								
								return promise
									.catch(err => reject(err.statusCode === 409 ? `${ fullName } already exists.` : err))
									.then(() => console.log(`Successfully published ${ fullName }!`));
							});
						});
				});
		});
};