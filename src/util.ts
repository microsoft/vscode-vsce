import { Promise, nfcall } from 'q';
import { assign } from 'lodash';
import _read = require('read');
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { IQGalleryApi } from 'vso-node-api/GalleryApi';

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

export function read(prompt: string, options: _read.Options = {}): Promise<string> {
	return nfcall<string>(_read, assign({ prompt }, options))
		.spread(r => r);
}

export function getGalleryAPI(pat: string): IQGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getQGalleryApi('https://app.market.visualstudio.com');
}