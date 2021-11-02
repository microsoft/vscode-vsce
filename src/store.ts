import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { home } from 'osenv';
import { read, getGalleryAPI, getSecurityRolesAPI, log } from './util';
import { validatePublisher } from './validation';
import { readManifest } from './package';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export interface IPublisher {
	readonly name: string;
	readonly pat: string;
}

export interface IStore extends Iterable<IPublisher> {
	get(name: string): IPublisher | undefined;
	add(publisher: IPublisher): Promise<void>;
	delete(name: string): Promise<void>;
}

export class FileStore implements IStore {
	private static readonly DefaultPath = path.join(home(), '.vsce');

	static async open(path: string = FileStore.DefaultPath): Promise<FileStore> {
		try {
			const rawStore = await readFile(path, 'utf8');
			return new FileStore(path, JSON.parse(rawStore).publishers);
		} catch (err) {
			if (err.code === 'ENOENT') {
				return new FileStore(path, []);
			} else if (/SyntaxError/.test(err.message)) {
				throw new Error(`Error parsing file store: ${path}`);
			}

			throw err;
		}
	}

	private constructor(private readonly path: string, private publishers: IPublisher[]) {}

	private async save(): Promise<void> {
		await writeFile(this.path, JSON.stringify({ publishers: this.publishers }), { mode: '0600' });
	}

	get(name: string): IPublisher | undefined {
		return this.publishers.filter(p => p.name === name)[0];
	}

	async add(publisher: IPublisher): Promise<void> {
		this.publishers = [...this.publishers.filter(p => p.name !== publisher.name), publisher];
		await this.save();
	}

	async delete(name: string): Promise<void> {
		this.publishers = this.publishers.filter(p => p.name !== name);
		await this.save();
	}

	[Symbol.iterator]() {
		return this.publishers[Symbol.iterator]();
	}
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

async function requestPAT(publisherName: string): Promise<string> {
	console.log('https://marketplace.visualstudio.com/manage/publishers/');

	const pat = await read(`Personal Access Token for publisher '${publisherName}':`, { silent: true, replace: '*' });
	await verifyPat(pat, publisherName);
	return pat;
}

export async function getPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);

	const store = await FileStore.open();
	let publisher = store.get(publisherName);

	if (publisher) {
		return publisher;
	}

	const pat = await requestPAT(publisherName);
	publisher = { name: publisherName, pat };
	await store.add(publisher);

	return publisher;
}

export async function loginPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);

	const store = await FileStore.open();
	let publisher = store.get(publisherName);

	if (publisher) {
		console.log(`Publisher '${publisherName}' is already known`);
		const answer = await read('Do you want to overwrite its PAT? [y/N] ');

		if (!/^y$/i.test(answer)) {
			throw new Error('Aborted');
		}
	}

	const pat = await requestPAT(publisherName);
	publisher = { name: publisherName, pat };
	await store.add(publisher);

	return publisher;
}

export async function logoutPublisher(publisherName: string): Promise<void> {
	validatePublisher(publisherName);

	const store = await FileStore.open();
	const publisher = store.get(publisherName);

	if (!publisher) {
		throw new Error(`Unknown publisher '${publisherName}'`);
	}

	await store.delete(publisherName);
}

export async function deletePublisher(publisherName: string): Promise<void> {
	const publisher = await getPublisher(publisherName);
	const answer = await read(`This will FOREVER delete '${publisherName}'! Are you sure? [y/N] `);

	if (!/^y$/i.test(answer)) {
		throw new Error('Aborted');
	}

	const api = await getGalleryAPI(publisher.pat);
	await api.deletePublisher(publisherName);

	const store = await FileStore.open();
	await store.delete(publisherName);
	log.done(`Deleted publisher '${publisherName}'.`);
}

export async function listPublishers(): Promise<void> {
	const store = await FileStore.open();

	for (const publisher of store) {
		console.log(publisher.name);
	}
}
