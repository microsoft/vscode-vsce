import { assign } from 'lodash';
import * as _read from 'read';
import * as fs from 'fs';
import * as path from 'path';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { IGalleryApi, IQGalleryApi } from 'vso-node-api/GalleryApi';
import * as denodeify from 'denodeify';
import urljoin = require('url-join');

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
	return vsoapi.getQGalleryApi('https://app.market.visualstudio.com');
}

export function getRawGalleryAPI(pat: string): IGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getGalleryApi('https://app.market.visualstudio.com');
}

export function normalize(path: string): string {
	return path.replace(/\\/g, '/');
}

export function massageMarkdownLinks(pathToMarkdown: string, prefix: string): Promise<string> {
	return readFile(pathToMarkdown, 'utf8').then(markdown => markdown.replace(/\[[^\[]+\]\(([^\)]+)\)/g, (titleAndLink, link) =>
		titleAndLink.replace(link, prepandRelativeLink(link, prefix))
	));
}

function prepandRelativeLink(link: string, prefix: string): string {
	// Prepand only relative links, also ignore links to the sections in markdown (they contain #).
	return /^(?:\w+:)\/\//.test(link) || link.indexOf('#') !== -1 ? link : urljoin(prefix, link);
}
