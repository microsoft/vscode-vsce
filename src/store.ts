import * as fs from 'fs';
import * as path from 'path';
import { home } from 'osenv';
import { read, getGalleryAPI, getSecurityRolesAPI, log } from './util';
import { validatePublisher } from './validation';
import * as denodeify from 'denodeify';
import { readManifest } from './package';

const readFile = denodeify<string, string, string>(fs.readFile);
const writeFile = denodeify<string, string, object, void>(fs.writeFile as any);
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
		.catch<string>(err => (err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve('{}')))
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
	return writeFile(storePath, JSON.stringify(store), { mode: '0600' }).then(() => store);
}

function addPublisherToStore(store: IStore, publisher: IPublisher): Promise<IPublisher> {
	store.publishers = [...store.publishers.filter(p => p.name !== publisher.name), publisher];
	return save(store).then(() => publisher);
}

function removePublisherFromStore(store: IStore, publisherName: string): Promise<any> {
	store.publishers = store.publishers.filter(p => p.name !== publisherName);
	return save(store);
}

export async function verifyPat(pat: string, publisherName?: string): Promise<void> {
	if (!pat) {
		throw new Error('The Personal Access Token is mandatory.');
	}

	if (!publisherName) {
		try {
			publisherName = (await readManifest()).publisher;
		} catch (error) {
			throw new Error(
				`Can not read the publisher's name. Either supply it as an argument or run vsce from the extension folder. Additional information:\n\n${error}`
			);
		}
	}

	try {
		// If the caller of the `getRoleAssignments` API has any of the roles
		// (Creator, Owner, Contributor, Reader) on the publisher, we get a 200,
		// otherwise we get a 403.
		const api = await getSecurityRolesAPI(pat);
		await api.getRoleAssignments('gallery.publisher', publisherName);
	} catch (error) {
		throw new Error('The Personal Access Token verification has failed. Additional information:\n\n' + error);
	}

	console.log(`The Personal Access Token verification succeeded for the publisher '${publisherName}'.`);
}

async function requestPAT(store: IStore, publisherName: string): Promise<IPublisher> {
	const pat = await read(`Personal Access Token for publisher '${publisherName}':`, { silent: true, replace: '*' });

	await verifyPat(pat, publisherName);

	return await addPublisherToStore(store, { name: publisherName, pat });
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
				return read('Do you want to overwrite its PAT? [y/N] ').then(answer =>
					/^y$/i.test(answer) ? store : Promise.reject('Aborted')
				);
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

export function deletePublisher(publisherName: string): Promise<any> {
	return getPublisher(publisherName).then(({ pat }) => {
		return read(`This will FOREVER delete '${publisherName}'! Are you sure? [y/N] `)
			.then(answer => (/^y$/i.test(answer) ? null : Promise.reject('Aborted')))
			.then(() => getGalleryAPI(pat))
			.then(api => api.deletePublisher(publisherName))
			.then(() => load().then(store => removePublisherFromStore(store, publisherName)))
			.then(() => log.done(`Deleted publisher '${publisherName}'.`));
	});
}

export function listPublishers(): Promise<void> {
	return load()
		.then(store => store.publishers)
		.then(publishers => publishers.forEach(p => console.log(p.name)));
}
