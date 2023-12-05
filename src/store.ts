import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { read, getGalleryAPI, getSecurityRolesAPI, log } from './util';
import { validatePublisher } from './validation';
import { readManifest } from './package';

export interface IPublisher {
	readonly name: string;
	readonly pat: string;
}

export interface IStore extends Iterable<IPublisher> {
	readonly size: number;
	get(name: string): IPublisher | undefined;
	add(publisher: IPublisher): Promise<void>;
	delete(name: string): Promise<void>;
}

export class FileStore implements IStore {
	private static readonly DefaultPath = path.join(homedir(), '.vsce');

	static async open(path: string = FileStore.DefaultPath): Promise<FileStore> {
		try {
			const rawStore = await fs.promises.readFile(path, 'utf8');
			return new FileStore(path, JSON.parse(rawStore).publishers);
		} catch (err: any) {
			if (err.code === 'ENOENT') {
				return new FileStore(path, []);
			} else if (/SyntaxError/.test(err)) {
				throw new Error(`Error parsing file store: ${path}`);
			}

			throw err;
		}
	}

	get size(): number {
		return this.publishers.length;
	}

	private constructor(readonly path: string, private publishers: IPublisher[]) {}

	private async save(): Promise<void> {
		await fs.promises.writeFile(this.path, JSON.stringify({ publishers: this.publishers }), { mode: '0600' });
	}

	async deleteStore(): Promise<void> {
		try {
			await fs.promises.unlink(this.path);
		} catch {
			// noop
		}
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

export class KeytarStore implements IStore {
	static async open(serviceName = 'vscode-vsce'): Promise<KeytarStore> {
		const keytar = await import('keytar');
		const creds = await keytar.findCredentials(serviceName);

		return new KeytarStore(
			keytar,
			serviceName,
			creds.map(({ account, password }) => ({ name: account, pat: password }))
		);
	}

	get size(): number {
		return this.publishers.length;
	}

	private constructor(
		private readonly keytar: typeof import('keytar'),
		private readonly serviceName: string,
		private publishers: IPublisher[]
	) {}

	get(name: string): IPublisher {
		return this.publishers.filter(p => p.name === name)[0];
	}

	async add(publisher: IPublisher): Promise<void> {
		this.publishers = [...this.publishers.filter(p => p.name !== publisher.name), publisher];
		await this.keytar.setPassword(this.serviceName, publisher.name, publisher.pat);
	}

	async delete(name: string): Promise<void> {
		this.publishers = this.publishers.filter(p => p.name !== name);
		await this.keytar.deletePassword(this.serviceName, name);
	}

	[Symbol.iterator](): Iterator<IPublisher, any, undefined> {
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

async function openDefaultStore(): Promise<IStore> {
	if (/^file$/i.test(process.env['VSCE_STORE'] ?? '')) {
		return await FileStore.open();
	}

	let keytarStore: IStore;

	try {
		keytarStore = await KeytarStore.open();
	} catch (err) {
		const store = await FileStore.open();
		log.warn(`Failed to open credential store. Falling back to storing secrets clear-text in: ${store.path}`);
		return store;
	}

	const fileStore = await FileStore.open();

	// migrate from file store
	if (fileStore.size) {
		for (const publisher of fileStore) {
			await keytarStore.add(publisher);
		}

		await fileStore.deleteStore();
		log.info(
			`Migrated ${fileStore.size} publishers to system credential manager. Deleted local store '${fileStore.path}'.`
		);
	}

	return keytarStore;
}

export async function getPublisher(publisherName: string): Promise<IPublisher> {
	validatePublisher(publisherName);

	const store = await openDefaultStore();
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

	const store = await openDefaultStore();
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

	const store = await openDefaultStore();
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

	const store = await openDefaultStore();
	await store.delete(publisherName);
	log.done(`Deleted publisher '${publisherName}'.`);
}

export async function listPublishers(): Promise<void> {
	const store = await openDefaultStore();

	for (const publisher of store) {
		console.log(publisher.name);
	}
}
