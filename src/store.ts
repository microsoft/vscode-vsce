import * as fs from 'fs';
import * as path from 'path';
import { home } from 'osenv';
import { read, getGalleryAPI } from './util';
import { validatePublisher } from './validation';
import * as denodeify from 'denodeify';

const readFile = denodeify<string, string, string>(fs.readFile);
const writeFile = denodeify<string, string, void>(fs.writeFile);
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
	return readFile(storePath, 'utf8')
		.catch<string>(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve('{}'))
		.then<IStore>(rawStore => {
			try {
				return Promise.resolve(JSON.parse(rawStore));
			} catch (e) {
				return Promise.reject(`Error parsing store: ${storePath}`);
			}
		})
		.then(store => {
			store.publishers = store.publishers || [];
			return Promise.resolve(store);
		});
}

function save(store: IStore): Promise<IStore> {
	return writeFile(storePath, JSON.stringify(store))
		.then(() => store);
}

function addPublisherToStore(store: IStore, publisher: IPublisher): Promise<IPublisher> {
	store.publishers = [...store.publishers.filter(p => p.name !== publisher.name), publisher];
	return save(store).then(() => publisher);
}

function removePublisherFromStore(store: IStore, publisherName: string): Promise<any> {
	store.publishers = store.publishers.filter(p => p.name !== publisherName);
	return save(store);
}

function requestPAT(store: IStore, publisherName: string): Promise<IPublisher> {
	return read(`Personal Access Token for publisher '${publisherName}':`, { silent: true, replace: '*' })
		.then(pat => {
			const api = getGalleryAPI(pat);

			return api.getPublisher(publisherName).then(p => {
				if (!p) {
					return Promise.reject(`Publisher '${publisherName}' not found. Please create one with 'vsce create-publisher'.`);
				}

				if (p.publisherName !== publisherName) {
					return Promise.reject(`Wrong publisher name '${publisherName}'. Found '${p.publisherName}' instead.`);
				}

				console.log(`Authentication successful. Found publisher '${p.displayName}'.`);
				return pat;
			});
		})
		.then(pat => addPublisherToStore(store, { name: publisherName, pat }));
}

export function getPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);

	return load().then(store => {
		const publisher = store.publishers.filter(p => p.name === publisherName)[0];
		return publisher ? Promise.resolve(publisher) : requestPAT(store, publisherName);
	});
}

export function loginPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);

	return load()
		.then<IStore>(store => {
			const publisher = store.publishers.filter(p => p.name === publisherName)[0];

			if (publisher) {
				console.log(`Publisher '${publisherName}' is already known`);
				return read('Do you want to overwrite its PAT? [y/N] ')
					.then(answer => /^y$/i.test(answer) ? store : Promise.reject('Aborted'));
			}

			return Promise.resolve(store);
		})
		.then(store => requestPAT(store, publisherName));
}

export function logoutPublisher(publisherName: string): Promise<any> {
	validatePublisher(publisherName);

	return load().then(store => {
		const publisher = store.publishers.filter(p => p.name === publisherName)[0];

		if (!publisher) {
			return Promise.reject(`Unknown publisher '${publisherName}'`);
		}

		return removePublisherFromStore(store, publisherName);
	});
}

export function createPublisher(publisherName: string): Promise<any> {
	validatePublisher(publisherName);

	return read(`Publisher human-friendly name: `, { default: publisherName }).then(displayName => {
		return read(`E-mail: `).then(email => {
			return read(`Personal Access Token:`, { silent: true, replace: '*' })
				.then(pat => {
					const api = getGalleryAPI(pat);
					const raw = {
						publisherName,
						displayName,
						extensions: [],
						flags: null,
						lastUpdated: null,
						longDescription: '',
						publisherId: null,
						shortDescription: '',
						emailAddress: [email]
					};

					return api.createPublisher(raw)
						.then(() => ({ name: publisherName, pat }));
				})
				.then(publisher => load().then(store => addPublisherToStore(store, publisher)));
		});
	})
		.then(() => console.log(`Successfully created publisher '${publisherName}'.`));
}

export function deletePublisher(publisherName: string): Promise<any> {
	return getPublisher(publisherName).then(({ pat }) => {
		return read(`This will FOREVER delete '${publisherName}'! Are you sure? [y/N] `)
			.then(answer => /^y$/i.test(answer) ? null : Promise.reject('Aborted'))
			.then(() => getGalleryAPI(pat))
			.then(api => api.deletePublisher(publisherName))
			.then(() => load().then(store => removePublisherFromStore(store, publisherName)))
			.then(() => console.log(`Successfully deleted publisher '${publisherName}'.`));
	});
}

export function listPublishers(): Promise<void> {
	return load()
		.then(store => store.publishers)
		.then(publishers => publishers.forEach(p => console.log(p.name)));
}