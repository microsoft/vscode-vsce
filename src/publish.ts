import { readFile } from 'fs';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { IQGalleryApi } from 'vso-node-api/GalleryApi';
import { ExtensionQueryFlags, PublishedExtension } from 'vso-node-api/interfaces/GalleryInterfaces';
import { nfcall, Promise, reject, resolve, all } from 'q';
import { pack, IPackageResult } from './package';
import { tmpName } from 'tmp';
import { getCredentials, ICredentials } from './login';

const galleryUrl = 'https://app.market.visualstudio.com';

function getGalleryAPI({ account, pat }: ICredentials): IQGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi(account, authHandler);
	return vsoapi.getQGalleryApi(galleryUrl);
}

export function publish(cwd = process.cwd()): Promise<any> {
	return getCredentials({ promptIfMissing: true })
		.then(getGalleryAPI)
		.then(api => nfcall<string>(tmpName)
			.then(packagePath => pack(packagePath, cwd))
			.then(({ manifest, packagePath }) => nfcall<string>(readFile, packagePath, 'base64')
				.then(extensionManifest => {
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
				})
			)
		);
};