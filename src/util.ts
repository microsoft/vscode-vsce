import { assign } from 'lodash';
import * as _read from 'read';
import * as fs from 'fs';
import * as path from 'path';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { IGalleryApi, IQGalleryApi } from 'vso-node-api/GalleryApi';
import * as denodeify from 'denodeify';

const readFile = denodeify<string, string, string>(fs.readFile);

export function fatal<T>(message: any, ...args: any[]): Promise<T> {
	if (message instanceof Error) {
		if (/^cancell?ed$/i.test(message.message)) {
			return;
		}

		message = message.message;
	}

	console.error('Error:', message, ...args);
	process.exit(1);
	return Promise.resolve<T>(null);
}

export function catchFatal<T>(promise: Promise<T>): Promise<T> {
	return promise.catch<T>(fatal);
}

const __read = denodeify<_read.Options,string>(_read);
export function read(prompt: string, options: _read.Options = {}): Promise<string> {
	return __read(assign({ prompt }, options));
}

export function getGalleryAPI(pat: string): IQGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getQGalleryApi('https://marketplace.visualstudio.com');
}

export function getRawGalleryAPI(pat: string): IGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getGalleryApi('https://marketplace.visualstudio.com');
}

export function normalize(path: string): string {
	return path.replace(/\\/g, '/');
}

function chain2<A,B>(a: A, b: B[], fn: (a: A, b: B)=>Promise<A>, index = 0): Promise<A> {
	if (index >= b.length) {
		return Promise.resolve(a);
	}
	
	return fn(a, b[index]).then(a => chain2(a, b, fn, index + 1));
}

export function chain<T,P>(initial: T, processors: P[], process: (a: T, b: P)=>Promise<T>): Promise<T> {
	return chain2(initial, processors, process);
}