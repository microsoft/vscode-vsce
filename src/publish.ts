import { readFile } from 'fs';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import gallery = require('vso-node-api/GalleryApi');
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
					
					return nfcall<string>(readFile, packagePath, 'base64')
						.then(extensionManifest => {
							return api.createExtension({ extensionManifest });
						});
				});
		});
};