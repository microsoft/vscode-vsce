import { readFile } from 'fs';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { ExtensionQueryFlags, PublishedExtension } from 'vso-node-api/interfaces/GalleryInterfaces';
import { nfcall, Promise, reject, resolve, all } from 'q';
import { pack, IPackageResult } from './package';
import { tmpName } from 'tmp';
import { getCredentials } from './login';

const galleryUrl = 'https://app.market.visualstudio.com';

export function publish(cwd = process.cwd()): Promise<any> {
	return getCredentials({ promptIfMissing: true })
		.then(credentials => {
			const authHandler = getBasicHandler('oauth', credentials.pat);
			const vsoapi = new WebApi(credentials.account, authHandler);
			const api = vsoapi.getQGalleryApi(galleryUrl);
			
			return nfcall<string>(tmpName)
				.then(packagePath => pack(packagePath, cwd))
				.then(result => {
					const { manifest, packagePath } = result;
					const fullName = `${ manifest.name }@${ manifest.version }`;
					
					return nfcall<string>(readFile, packagePath, 'base64').then(extensionManifest => {
						console.log(`Publishing ${ fullName }...`);
						return api.getExtension(credentials.publisher, manifest.name, null, ExtensionQueryFlags.IncludeVersions)
							.catch<PublishedExtension>(err => err.statusCode === 404 ? null : reject(err))
							.then(extension => {
								if (extension && extension.versions.some(v => v.version === manifest.version)) {
									return reject<void>(`${ fullName } already exists.`);
								}
								
								var promise = extension
									? api.updateExtension({ extensionManifest }, credentials.publisher, manifest.name)
									: api.createExtension({ extensionManifest });
								
								return promise
									.catch(err => reject(err.statusCode === 409 ? `${ fullName } already exists.` : err))
									.then(() => console.log(`Successfully published ${ fullName }!`));
							});
					});
				});
		});
};