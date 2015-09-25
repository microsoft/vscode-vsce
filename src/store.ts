import * as fs from 'fs';
import * as path from 'path';
import { Promise, nfcall, resolve, reject } from 'q';
import { home } from 'osenv';
import { read, getGalleryAPI } from './util';
import { validatePublisher } from './validation';

const storePath = path.join(home(), '.vsce');

export interface IStore {
	[publisher: string]: string;
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
		});
}

function save(store: IStore): Promise<IStore> {
	return nfcall<void>(fs.writeFile, storePath, JSON.stringify(store))
		.then(() => store);
}

function requestPAT(store: IStore, publisher: string): Promise<string> {
	return read(`Personal Access Token for publisher '${ publisher }':`, { silent: true, replace: '*' })
		.then(pat => {
			const api = getGalleryAPI(pat);
			
			return api.getPublisher(publisher).then(p => {
				console.log(`Authentication successful. Found publisher '${ p.displayName }'.`);
				return pat;
			});
		})
		.then(pat => {
			store[publisher] = pat;
			return save(store).then(() => pat);
		});
}

export function get(publisher: string): Promise<string> {
	validatePublisher(publisher);
	
	return load().then(store => {
		if (store[publisher]) {
			return resolve(store[publisher]);
		}
		
		return requestPAT(store, publisher);
	});
}

function add(publisher: string): Promise<string> {
	validatePublisher(publisher);
	
	return load()
		.then<IStore>(store => {
			if (store[publisher]) {
				console.log(`Publisher '${ publisher }' is already known`);
				return read('Do you want to overwrite its PAT? [y/N] ')
					.then(answer => /^y$/i.test(answer) ? store : reject('Aborted'));
			}
			
			return resolve(store);
		})
		.then(store => requestPAT(store, publisher));
}

function rm(publisher: string): Promise<any> {
	validatePublisher(publisher);
	
	return load().then(store => {
		if (!store[publisher]) {
			return reject(`Unknown publisher '${ publisher }'`);
		}
		
		delete store[publisher];
		return save(store);
	});
}

function list(): Promise<string[]> {
	return load().then(store => Object.keys(store));
}

export function publisher(action: string, publisher: string): Promise<any> {
	switch (action) {
		case 'add': return add(publisher);
		case 'rm': return rm(publisher);
		case 'list': default: return list().then(publishers => publishers.forEach(p => console.log(p)));
	}
}