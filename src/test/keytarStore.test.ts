import * as assert from 'assert';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { ILegacyMigrationOptions, LegacyCredentialMigration } from '../keytarMigration';
import { LegacyMigrationError } from '../legacyCredentials';
import { getPAT } from '../publish';
import { FileStore, getPublisher, IKeytar, KeytarStore, listPublishers, loginPublisher, logoutPublisher } from '../store';
import * as util from '../util';

describe('KeytarStore', () => {
	it('only opens the current store; opening does not migrate anything', async () => {
		const keyring = new TestKeyring();
		keyring.passwords.set('publisher', 'current-secret');
		const store = await KeytarStore.open('service', keyring);
		assert.deepStrictEqual(keyring.operations, ['find']);
		assert.deepStrictEqual([...store], [{ name: 'publisher', pat: 'current-secret' }]);
		assert.strictEqual(store.get('missing'), undefined);
	});

	it('does not cache an add until the native write succeeds', async () => {
		const keyring = new TestKeyring();
		keyring.passwords.set('publisher', 'current-secret');
		const store = await KeytarStore.open('service', keyring);
		keyring.setError = new Error('Write failed');
		await assert.rejects(store.add({ name: 'publisher', pat: 'replacement' }), /Write failed/);
		assert.strictEqual(store.get('publisher')?.pat, 'current-secret');
	});

	it('does not report a failed native delete as a successful logout', async () => {
		const keyring = new TestKeyring();
		keyring.passwords.set('publisher', 'current-secret');
		const store = await KeytarStore.open('service', keyring);
		keyring.deleteResult = false;
		await assert.rejects(store.delete('publisher'), /Could not remove/);
		assert.strictEqual(store.get('publisher')?.pat, 'current-secret');
	});
});

describe('Default credential store migration', () => {
	let directory: string;
	let fileStore: FileStore;
	let keyring: TestKeyring;
	let options: ILegacyMigrationOptions;
	let output: string[];
	let questions: string[];
	let lookups: string[];
	let response: string;
	let originalStoreEnvironment: string | undefined;
	const originalFileOpen = FileStore.open;
	const originalKeytarOpen = KeytarStore.open;
	const originalWrap = LegacyCredentialMigration.wrap;
	const originalLog = console.log;
	const originalWarn = util.log.warn;
	const originalInfo = util.log.info;
	const readDescriptor = Object.getOwnPropertyDescriptor(util, 'read')!;

	beforeEach(async () => {
		directory = fs.mkdtempSync(path.join(tmpdir(), 'vsce-default-store-test-'));
		fileStore = await originalFileOpen(path.join(directory, 'store.json'));
		keyring = new TestKeyring();
		output = [];
		questions = [];
		lookups = [];
		response = 'y';
		originalStoreEnvironment = process.env.VSCE_STORE;
		delete process.env.VSCE_STORE;
		FileStore.open = async () => fileStore;
		KeytarStore.open = async () => originalKeytarOpen('service', keyring);
		options = {
			platform: 'linux',
			interactive: true,
			lockPath: path.join(directory, 'lock'),
			readCredential: async (_service, name) => {
				lookups.push(name);
				return name === 'legacy' ? { name, pat: 'legacy-secret' } : undefined;
			},
			prompt: async question => { questions.push(question); return response; },
		};
		LegacyCredentialMigration.wrap = (store, openStore) => originalWrap(store, openStore, options);
		console.log = value => output.push(String(value));
		util.log.info = value => output.push(String(value));
		util.log.warn = value => output.push(String(value));
		Object.defineProperty(util, 'read', {
			...readDescriptor,
			value: async (question: string) => {
				questions.push(question);
				if (question.startsWith('Personal Access Token')) {
					throw new ManualPatRequested();
				}
				return 'n';
			},
		});
	});

	afterEach(() => {
		FileStore.open = originalFileOpen;
		KeytarStore.open = originalKeytarOpen;
		LegacyCredentialMigration.wrap = originalWrap;
		console.log = originalLog;
		util.log.warn = originalWarn;
		util.log.info = originalInfo;
		Object.defineProperty(util, 'read', readDescriptor);
		if (originalStoreEnvironment === undefined) {
			delete process.env.VSCE_STORE;
		} else {
			process.env.VSCE_STORE = originalStoreEnvironment;
		}
		fs.rmSync(directory, { recursive: true, force: true });
	});

	it('offers migration when publishing needs a PAT absent from the current store', async () => {
		assert.strictEqual(await getPAT('legacy', {}), 'legacy-secret');
		assert.deepStrictEqual(lookups, ['legacy']);
		assert.strictEqual(questions.length, 1);
		assert.ok(questions[0].includes('Copy it to the new store? [y/N]'));
		assert.strictEqual(keyring.passwords.get('legacy'), 'legacy-secret');
		assert.ok(![...questions, ...output].some(line => line.includes('legacy-secret')));
	});

	it('also offers migration when logging in a publisher without a current PAT', async () => {
		assert.deepStrictEqual(await loginPublisher('legacy'), { name: 'legacy', pat: 'legacy-secret' });
		assert.strictEqual(questions.length, 1);
		assert.deepStrictEqual(lookups, ['legacy']);
	});

	it('does not look up old credentials when the current publisher already has a PAT', async () => {
		keyring.passwords.set('legacy', 'newer-secret');
		assert.strictEqual((await getPublisher('legacy')).pat, 'newer-secret');
		assert.deepStrictEqual(questions, []);
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(keyring.operations, ['find']);
	});

	it('keeps the existing overwrite question for an explicit login with a current PAT', async () => {
		keyring.passwords.set('legacy', 'newer-secret');
		await assert.rejects(loginPublisher('legacy'), /Aborted/);
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, ['Do you want to overwrite its PAT? [y/N] ']);
	});

	for (const answer of ['n', '']) {
		it(`continues to normal PAT entry when migration is declined with ${JSON.stringify(answer)}`, async () => {
			response = answer;
			await assert.rejects(getPublisher('legacy'), ManualPatRequested);
			assert.strictEqual(questions.length, 2);
			assert.ok(questions[1].startsWith('Personal Access Token'));
			assert.strictEqual(keyring.passwords.has('legacy'), false);
		});
	}

	it('continues to normal PAT entry when login declines migration', async () => {
		response = 'n';
		await assert.rejects(loginPublisher('legacy'), ManualPatRequested);
		assert.strictEqual(questions.length, 2);
		assert.strictEqual(keyring.passwords.size, 0);
	});

	it('asks only for a PAT if neither store contains the publisher', async () => {
		await assert.rejects(getPublisher('missing'), ManualPatRequested);
		assert.deepStrictEqual(lookups, ['missing']);
		assert.strictEqual(questions.length, 1);
		assert.ok(questions[0].startsWith('Personal Access Token'));
	});

	it('never migrates while listing publishers', async () => {
		keyring.passwords.set('current', 'current-secret');
		await listPublishers();
		assert.deepStrictEqual(output, ['current']);
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
		assert.ok(!fs.existsSync(options.lockPath!));
	});

	it('never migrates during logout and offers again only on a later PAT lookup', async () => {
		keyring.passwords.set('legacy', 'current-secret');
		await logoutPublisher('legacy');
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
		response = 'n';
		await assert.rejects(getPublisher('legacy'), ManualPatRequested);
		assert.strictEqual(keyring.passwords.has('legacy'), false);
	});

	it('does not access legacy credentials when logging out an unknown publisher', async () => {
		await assert.rejects(logoutPublisher('legacy'), /Unknown publisher/);
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
	});

	it('skips migration entirely in non-interactive runs', async () => {
		options = { ...options, interactive: false };
		await assert.rejects(getPublisher('legacy'), ManualPatRequested);
		assert.deepStrictEqual(lookups, []);
		assert.strictEqual(questions.length, 1);
		assert.ok(questions[0].startsWith('Personal Access Token'));
	});

	it('keeps the existing plaintext-file migration working without looking up keytar entries', async () => {
		await fileStore.add({ name: 'file-publisher', pat: 'file-secret' });
		assert.strictEqual((await getPublisher('file-publisher')).pat, 'file-secret');
		assert.strictEqual(keyring.passwords.get('file-publisher'), 'file-secret');
		assert.ok(!fs.existsSync(fileStore.path));
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
	});

	it('does not access either native store with VSCE_STORE=file', async () => {
		process.env.VSCE_STORE = 'FiLe';
		await fileStore.add({ name: 'legacy', pat: 'file-secret' });
		KeytarStore.open = async () => assert.fail('Unexpected native credential access');
		assert.strictEqual((await getPublisher('legacy')).pat, 'file-secret');
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
		assert.ok(fs.existsSync(fileStore.path));
	});

	it('does not access saved credentials when a PAT is supplied explicitly', async () => {
		KeytarStore.open = async () => assert.fail('Unexpected native credential access');
		FileStore.open = async () => assert.fail('Unexpected file-store access');
		assert.strictEqual(await getPAT('legacy', { pat: 'explicit-pat' }), 'explicit-pat');
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
	});

	it('preserves file fallback when opening the current native store fails', async () => {
		keyring.findError = new Error('Native store unavailable');
		await fileStore.add({ name: 'legacy', pat: 'file-secret' });
		assert.strictEqual((await getPublisher('legacy')).pat, 'file-secret');
		assert.ok(output.some(line => line.includes('Failed to open credential store')));
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(questions, []);
	});

	it('warns and uses the normal PAT prompt when the legacy helper is unavailable', async () => {
		options = { ...options, readCredential: async () => { throw new LegacyMigrationError('secret-tool is not installed.'); } };
		await assert.rejects(getPublisher('legacy'), ManualPatRequested);
		assert.ok(output.some(line => line.includes('secret-tool is not installed')));
		assert.strictEqual(questions.length, 1);
		assert.ok(questions[0].startsWith('Personal Access Token'));
	});
});

class ManualPatRequested extends Error { }

class TestKeyring implements IKeytar {
	readonly passwords = new Map<string, string>();
	readonly operations: string[] = [];
	findError?: Error;
	setError?: Error;
	deleteResult = true;

	async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
		assert.strictEqual(service, 'service');
		this.operations.push('find');
		if (this.findError) {
			throw this.findError;
		}
		return [...this.passwords].map(([account, password]) => ({ account, password }));
	}

	async setPassword(service: string, name: string, password: string): Promise<void> {
		assert.strictEqual(service, 'service');
		this.operations.push(`set:${name}`);
		if (this.setError) {
			throw this.setError;
		}
		this.passwords.set(name, password);
	}

	async deletePassword(service: string, name: string): Promise<boolean> {
		assert.strictEqual(service, 'service');
		this.operations.push(`delete:${name}`);
		return this.deleteResult && this.passwords.delete(name);
	}
}
