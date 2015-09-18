import { readFile } from 'fs';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import gallery = require('vso-node-api/GalleryApi');
import { nfcall, Promise, reject, resolve, all } from 'q';
import { pack, IPackageResult } from './package';
import { tmpName } from 'tmp';

const galleryUrl = 'https://app.market.visualstudio.com';
const accountUrl = 'https://monacotools.visualstudio.com';

export function publish(pat: string, cwd = process.cwd()): Promise<any> {
	if (!pat) {
		return reject('Missing Personal Access Token');
	}
	
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi(accountUrl, authHandler);
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
};