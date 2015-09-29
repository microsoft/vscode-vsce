import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { Promise, nfcall, resolve, reject } from 'q';
import { home } from 'osenv';
import { read, getGalleryAPI } from './util';
import { validatePublisher } from './validation';

const storePath = path.join(home(), '.vsce');

export interface IPublisher {
	name: string;
	pat: string;
}

export interface IStore {
	publishers: IPublisher[];
}

export interface IGetOptions {
	promptToOverwrite?: boolean;
	promptIfMissing?: boolean;
}

function load(): Promise<IStore> {
	return nfcall<string>(fs.readFile, storePath, 'utf8')
		.catch<string>(err => err.code !== 'ENOENT' ? reject(err) : resolve('{}'))
		.then<IStore>(rawStore => {
			try {
				return resolve(JSON.parse(rawStore));
			} catch (e) {
				return reject(`Error parsing store: ${ storePath }`);
			}
		})
		.then(store => {
			store.publishers = store.publishers || [];
			return resolve(store);
		});
}

function save(store: IStore): Promise<IStore> {
	return nfcall<void>(fs.writeFile, storePath, JSON.stringify(store))
		.then(() => {
			if (process.platform !== 'win32') {
				return resolve(null);
			}
			
			return nfcall(exec, `attrib +H ${ storePath }`);
		})
		.then(() => store);
}

function requestPAT(store: IStore, publisherName: string): Promise<IPublisher> {
	return read(`Personal Access Token for publisher '${ publisherName }':`, { silent: true, replace: '*' })
		.then(pat => {
			const api = getGalleryAPI(pat);
			
			return api.getPublisher(publisherName).then(p => {
				console.log(`Authentication successful. Found publisher '${ p.displayName }'.`);
				return pat;
			});
		})
		.then(pat => {
			const publisher = { name: publisherName, pat };
			store.publishers = [...store.publishers.filter(p => p.name !== publisherName), publisher];
			return save(store).then(() => publisher);
		});
}

export function getPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);
	
	return load().then(store => {
		const publisher = store.publishers.filter(p => p.name === publisherName)[0];
		return publisher ? resolve(publisher) : requestPAT(store, publisherName);
	});
}

function addPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);
	
	return load()
		.then<IStore>(store => {
			const publisher = store.publishers.filter(p => p.name === publisherName)[0];
			
			if (publisher) {
				console.log(`Publisher '${ publisherName }' is already known`);
				return read('Do you want to overwrite its PAT? [y/N] ')
					.then(answer => /^y$/i.test(answer) ? store : reject('Aborted'));
			}
			
			return resolve(store);
		})
		.then(store => requestPAT(store, publisherName));
}

function rmPublisher(publisherName: string): Promise<any> {
	validatePublisher(publisherName);
	
	return load().then(store => {
		const publisher = store.publishers.filter(p => p.name === publisherName)[0];
		
		if (!publisher) {
			return reject(`Unknown publisher '${ publisherName }'`);
		}
		
		store.publishers = store.publishers.filter(p => p.name !== publisherName);
		return save(store);
	});
}

function listPublishers(): Promise<IPublisher[]> {
	return load().then(store => store.publishers);
}

export function publisher(action: string, publisher: string): Promise<any> {
	switch (action) {
		case 'add': return addPublisher(publisher);
		case 'rm': return rmPublisher(publisher);
		case 'list': default: return listPublishers().then(publishers => publishers.forEach(p => console.log(p.name)));
	}
}