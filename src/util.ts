import { assign } from 'lodash';
import * as _read from 'read';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { IGalleryApi, IQGalleryApi } from 'vso-node-api/GalleryApi';
import * as denodeify from 'denodeify';

export function fatal(message: any, ...args: any[]) {
	if (message instanceof Error) {
		if (/^cancell?ed$/i.test(message.message)) {
			return;
		}
		
		message = message.message;
	}
	
	console.error('Error:', message, ...args);
	process.exit(1);
}

const __read = denodeify<_read.Options,string>(_read);
export function read(prompt: string, options: _read.Options = {}): Promise<string> {
	return __read(assign({ prompt }, options));
}

export function getGalleryAPI(pat: string): IQGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getQGalleryApi('https://app.market.visualstudio.com');
}

export function getRawGalleryAPI(pat: string): IGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getGalleryApi('https://app.market.visualstudio.com');
}