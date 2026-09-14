import * as assert from 'assert';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { LegacyCredentialMigration, ILegacyMigrationOptions } from '../keytarMigration';
import { CredentialCommandRunner, LegacyMigrationError, readLegacyCredential } from '../legacyCredentials';
import { IPublisher, IStore } from '../store';
import { log } from '../util';

describe('Legacy credential readers', () => {
	it('reads only the requested Windows account, without interpolating identifiers into PowerShell', async () => {
		const run: CredentialCommandRunner = async (file, args, env) => {
			assert.strictEqual(path.win32.basename(file), 'powershell.exe');
			assert.ok(args.includes('-NoProfile'));
			assert.ok(args.includes('-NonInteractive'));
			const script = args[args.length - 1];
			assert.ok(script.includes('CredReadW'));
			assert.ok(script.includes('UTF8Encoding(false, true)'));
			assert.ok(!/CredWrite|CredDelete|CredEnumerate|withTarget/.test(script));
			assert.ok(!script.includes('service-with-quote\''));
			assert.strictEqual(env?.VSCE_KEYTAR_SERVICE, 'service-with-quote\'');
			assert.strictEqual(env?.VSCE_KEYTAR_ACCOUNT, 'publisher');
			return { stdout: '{"name":"PUBLISHER","pat":"odd-length-pat!"}', stderr: '', exitCode: 0 };
		};
		assert.deepStrictEqual(await readLegacyCredential('service-with-quote\'', 'publisher', { platform: 'win32', run }), {
			name: 'publisher', pat: 'odd-length-pat!',
		});
	});

	it('handles a missing Windows account', async () => {
		assert.strictEqual(await readLegacyCredential('service', 'publisher', {
			platform: 'win32', run: async () => ({ stdout: 'null\r\n', stderr: '', exitCode: 0 }),
		}), undefined);
	});

	for (const value of [
		'not-json-secret', '[]', '{}', '{"name":"publisher"}', '{"name":"publisher","pat":""}',
		'{"name":"other-account","pat":"not-json-secret"}',
	]) {
		it(`rejects invalid Windows output without disclosing credentials (${value.length} characters)`, async () => {
			await assert.rejects(readLegacyCredential('service', 'publisher', {
				platform: 'win32', run: async () => ({ stdout: value, stderr: '', exitCode: 0 }),
			}), (error: Error) => {
				assert.ok(error instanceof LegacyMigrationError);
				assert.ok(!error.message.includes('not-json-secret'));
				return true;
			});
		});
	}

	it('does not treat a failed Windows helper as a missing credential or disclose its output', async () => {
		await assert.rejects(readLegacyCredential('service', 'publisher', {
			platform: 'win32',
			run: async () => ({ stdout: 'secret-value', stderr: 'secret-value', exitCode: 1 }),
		}), (error: Error) => error instanceof LegacyMigrationError && !error.message.includes('secret-value'));
	});

	it('looks up only the requested Linux keytar account and preserves the exact PAT', async () => {
		const pat = '  exact-pat\n';
		const run: CredentialCommandRunner = async (file, args) => {
			assert.strictEqual(file, 'secret-tool');
			assert.deepStrictEqual(args, [
				'lookup', 'service', 'service', 'account', 'publisher', 'xdg:schema', 'org.freedesktop.Secret.Generic',
			]);
			return { stdout: pat, stderr: '', exitCode: 0 };
		};
		assert.deepStrictEqual(await readLegacyCredential('service', 'publisher', { platform: 'linux', run }), {
			name: 'publisher', pat,
		});
	});

	it('handles a missing Linux account without treating other helper failures as absence', async () => {
		assert.strictEqual(await readLegacyCredential('service', 'publisher', {
			platform: 'linux', run: async () => ({ stdout: '', stderr: '', exitCode: 1 }),
		}), undefined);
		for (const result of [
			{ stdout: '', stderr: 'keyring locked: secret-value', exitCode: 1 },
			{ stdout: 'secret-value', stderr: '', exitCode: 1 },
			{ stdout: '', stderr: '', exitCode: 2 },
			{ stdout: '', stderr: '', exitCode: 0 },
		]) {
			await assert.rejects(readLegacyCredential('service', 'publisher', {
				platform: 'linux', run: async () => result,
			}), (error: Error) => error instanceof LegacyMigrationError && !error.message.includes('secret-value'));
		}
	});

	it('propagates missing helper errors', async () => {
		for (const platform of ['win32', 'linux'] as const) {
			await assert.rejects(readLegacyCredential('service', 'publisher', {
				platform, run: async () => { throw new LegacyMigrationError('Helper unavailable'); },
			}), /Helper unavailable/);
		}
	});

	it('does not run a reader on macOS or unsupported platforms', async () => {
		for (const platform of ['darwin', 'freebsd'] as const) {
			assert.strictEqual(await readLegacyCredential('service', 'publisher', {
				platform, run: async () => assert.fail('Unexpected legacy access'),
			}), undefined);
		}
	});
});

describe('Prompted credential migration', () => {
	let directory: string;
	let options: ILegacyMigrationOptions;
	let passwords: Map<string, string>;
	let legacy: Map<string, string>;
	let lookups: string[];
	let prompts: string[];
	let writes: string[];
	let warnings: string[];
	let messages: string[];
	let response: string;
	const originalWarn = log.warn;
	const originalInfo = log.info;

	beforeEach(() => {
		directory = fs.mkdtempSync(path.join(tmpdir(), 'vsce-prompted-migration-'));
		passwords = new Map();
		legacy = new Map([['publisher', 'legacy-secret'], ['other', 'other-secret']]);
		lookups = [];
		prompts = [];
		writes = [];
		warnings = [];
		messages = [];
		response = 'y';
		log.warn = message => warnings.push(String(message));
		log.info = message => messages.push(String(message));
		options = {
			serviceName: 'test-service',
			lockPath: path.join(directory, 'lock'),
			platform: 'linux',
			interactive: true,
			prompt: async question => { prompts.push(question); return response; },
			readCredential: async (service, name) => {
				assert.strictEqual(service, 'test-service');
				lookups.push(name);
				const pat = legacy.get(name);
				return pat === undefined ? undefined : { name, pat };
			},
		};
	});

	afterEach(() => {
		log.warn = originalWarn;
		log.info = originalInfo;
		fs.rmSync(directory, { recursive: true, force: true });
	});

	async function openStore(): Promise<IStore> {
		return new MemoryStore(passwords, writes);
	}

	function migration(): LegacyCredentialMigration {
		return new LegacyCredentialMigration(new MemoryStore(passwords, writes), openStore, options);
	}

	it('does not access old credentials or prompt when merely opening, listing or logging out', async () => {
		passwords.set('current', 'current-secret');
		const store = migration();
		assert.strictEqual(store.size, 1);
		assert.deepStrictEqual([...store], [{ name: 'current', pat: 'current-secret' }]);
		await store.delete('current');
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(prompts, []);
	});

	it('does not access the previous store when a current PAT is available', async () => {
		passwords.set('publisher', 'current-secret');
		assert.deepStrictEqual(await migration().tryMigratePublisher('publisher'), {
			name: 'publisher', pat: 'current-secret',
		});
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(prompts, []);
		assert.deepStrictEqual(writes, []);
	});

	it('does not prompt when the publisher is absent from both stores', async () => {
		assert.strictEqual(await migration().tryMigratePublisher('missing'), undefined);
		assert.deepStrictEqual(lookups, ['missing']);
		assert.deepStrictEqual(prompts, []);
		assert.ok(!fs.existsSync(options.lockPath!));
	});

	for (const answer of ['y', 'Y', ' y ']) {
		it(`copies and verifies only the requested PAT after an explicit ${JSON.stringify(answer)}`, async () => {
			response = answer;
			const store = migration();
			assert.deepStrictEqual(await store.tryMigratePublisher('publisher'), { name: 'publisher', pat: 'legacy-secret' });
			assert.deepStrictEqual([...passwords], [['publisher', 'legacy-secret']]);
			assert.deepStrictEqual(lookups, ['publisher']);
			assert.deepStrictEqual(writes, ['publisher']);
			assert.strictEqual(prompts.length, 1);
			assert.ok(prompts[0].includes("'publisher'"));
			assert.ok(prompts[0].endsWith('[y/N] '));
			assert.strictEqual(messages.length, 1);
			assert.ok(![...prompts, ...messages, ...warnings].some(line => line.includes('legacy-secret')));
			assert.deepStrictEqual([...legacy], [['publisher', 'legacy-secret'], ['other', 'other-secret']]);
		});
	}

	for (const answer of ['n', 'N', '', 'yes', 'unexpected']) {
		it(`does not copy or suppress future offers after ${JSON.stringify(answer)}`, async () => {
			response = answer;
			assert.strictEqual(await migration().tryMigratePublisher('publisher'), undefined);
			assert.strictEqual(passwords.size, 0);
			assert.deepStrictEqual(writes, []);
			assert.deepStrictEqual(messages, []);
			assert.ok(!fs.existsSync(options.lockPath!));
			response = 'y';
			assert.strictEqual((await migration().tryMigratePublisher('publisher'))?.pat, 'legacy-secret');
			assert.strictEqual(prompts.length, 2);
		});
	}

	it('requires fresh confirmation after logout instead of silently restoring a retained PAT', async () => {
		const store = migration();
		await store.tryMigratePublisher('publisher');
		await store.delete('publisher');
		const reopened = migration();
		assert.strictEqual(reopened.get('publisher'), undefined);
		assert.strictEqual(prompts.length, 1);
		response = 'n';
		assert.strictEqual(await reopened.tryMigratePublisher('publisher'), undefined);
		assert.strictEqual(passwords.size, 0);
		response = 'y';
		await reopened.tryMigratePublisher('publisher');
		assert.strictEqual(prompts.length, 3);
		assert.strictEqual(passwords.get('publisher'), 'legacy-secret');
	});

	it('does not run helpers or prompt in non-interactive mode', async () => {
		options = { ...options, interactive: false };
		assert.strictEqual(await migration().tryMigratePublisher('publisher'), undefined);
		assert.deepStrictEqual(lookups, []);
		assert.deepStrictEqual(prompts, []);
		assert.deepStrictEqual(writes, []);
		assert.ok(!fs.existsSync(options.lockPath!));
	});

	it('cannot inherit the automatic yes from the normal test-mode prompt helper', async () => {
		const previous = process.env.VSCE_TESTS;
		process.env.VSCE_TESTS = '1';
		try {
			options = { ...options, interactive: undefined };
			assert.strictEqual(await migration().tryMigratePublisher('publisher'), undefined);
			assert.deepStrictEqual(lookups, []);
			assert.deepStrictEqual(prompts, []);
		} finally {
			if (previous === undefined) {
				delete process.env.VSCE_TESTS;
			} else {
				process.env.VSCE_TESTS = previous;
			}
		}
	});

	it('leaves compatible macOS and unsupported stores undecorated', async () => {
		for (const platform of ['darwin', 'freebsd'] as const) {
			const store = await openStore();
			assert.strictEqual(LegacyCredentialMigration.wrap(store, openStore, { ...options, platform }), store);
		}
		assert.deepStrictEqual(lookups, []);
	});

	it('preserves Windows account casing equivalence while Linux names remain case-sensitive', async () => {
		passwords.set('PUBLISHER', 'current-secret');
		options = { ...options, platform: 'win32' };
		assert.strictEqual((await migration().tryMigratePublisher('publisher'))?.pat, 'current-secret');
		assert.deepStrictEqual(prompts, []);
		options = { ...options, platform: 'linux' };
		assert.strictEqual((await migration().tryMigratePublisher('publisher'))?.pat, 'legacy-secret');
		assert.strictEqual(passwords.get('PUBLISHER'), 'current-secret');
	});

	it('keeps Windows updates and logout consistent with case-insensitive lookup', async () => {
		passwords.set('PUBLISHER', 'current-secret');
		options = { ...options, platform: 'win32' };
		const store = migration();
		await store.add({ name: 'publisher', pat: 'replacement' });
		assert.strictEqual(store.size, 1);
		assert.strictEqual(store.get('publisher')?.pat, 'replacement');
		assert.deepStrictEqual([...passwords], [['PUBLISHER', 'replacement']]);
		await store.delete('publisher');
		assert.strictEqual(store.get('publisher'), undefined);
		assert.strictEqual(store.size, 0);
		assert.strictEqual(passwords.size, 0);
		assert.deepStrictEqual(prompts, []);
	});

	it('warns about unavailable legacy storage without prompting or changing credentials', async () => {
		options = { ...options, readCredential: async () => { throw new LegacyMigrationError('secret-tool is not installed.'); } };
		assert.strictEqual(await migration().tryMigratePublisher('publisher'), undefined);
		assert.strictEqual(warnings.length, 1);
		assert.ok(warnings[0].includes('secret-tool is not installed'));
		assert.deepStrictEqual(prompts, []);
		assert.deepStrictEqual(writes, []);
	});

	it('rejects an unexpected legacy account without prompting', async () => {
		options = { ...options, readCredential: async () => ({ name: 'other', pat: 'other-secret' }) };
		assert.strictEqual(await migration().tryMigratePublisher('publisher'), undefined);
		assert.strictEqual(warnings.length, 1);
		assert.deepStrictEqual(prompts, []);
	});

	it('surfaces prompt failures instead of treating them as consent', async () => {
		options = { ...options, prompt: async () => { throw new Error('Input closed'); } };
		await assert.rejects(migration().tryMigratePublisher('publisher'), /Input closed/);
		assert.deepStrictEqual(writes, []);
	});

	it('reports native write errors without disclosing the PAT or caching a failed copy', async () => {
		const failedStore = await openStore();
		failedStore.add = async () => { throw new Error('Failure containing legacy-secret'); };
		const store = new LegacyCredentialMigration(await openStore(), async () => failedStore, options);
		assert.strictEqual(await store.tryMigratePublisher('publisher'), undefined);
		assert.strictEqual(store.get('publisher'), undefined);
		assert.strictEqual(warnings.length, 1);
		assert.ok(!warnings[0].includes('legacy-secret'));
		assert.deepStrictEqual(messages, []);
	});

	it('verifies against a freshly opened native store and rejects a mismatching copy', async () => {
		let opens = 0;
		const store = new LegacyCredentialMigration(await openStore(), async () => {
			opens++;
			return opens === 1 ? openStore() : new MemoryStore(new Map([['publisher', 'wrong-value']]), []);
		}, options);
		assert.strictEqual(await store.tryMigratePublisher('publisher'), undefined);
		assert.strictEqual(opens, 2);
		assert.strictEqual(store.get('publisher'), undefined);
		assert.strictEqual(warnings.length, 1);
		assert.deepStrictEqual(messages, []);
	});

	it('does not lock while asking and preserves a PAT saved by another command during the prompt', async () => {
		const peer = migration();
		options = {
			...options,
			prompt: async () => {
				await peer.add({ name: 'publisher', pat: 'newer-secret' });
				return 'y';
			},
		};
		assert.strictEqual((await migration().tryMigratePublisher('publisher'))?.pat, 'newer-secret');
		assert.deepStrictEqual(writes, ['publisher']);
		assert.deepStrictEqual(messages, []);
	});

	it('serializes concurrent logout after an in-flight migration copy', async () => {
		const copying = Promise.withResolvers<void>();
		const resume = Promise.withResolvers<void>();
		const destination = await openStore();
		const add = destination.add.bind(destination);
		destination.add = async publisher => {
			copying.resolve();
			await resume.promise;
			await add(publisher);
		};
		let opens = 0;
		const store = new LegacyCredentialMigration(await openStore(), async () => ++opens === 1 ? destination : openStore(), options);
		const importing = store.tryMigratePublisher('publisher');
		await copying.promise;
		const logout = migration().delete('publisher');
		try {
			assert.strictEqual(await Promise.race([
				logout.then(() => true),
				new Promise<boolean>(resolve => setTimeout(() => resolve(false), 100)),
			]), false);
		} finally {
			resume.resolve();
			await Promise.all([importing, logout]);
		}
		assert.strictEqual(passwords.has('publisher'), false);
		assert.strictEqual(migration().get('publisher'), undefined);
		assert.strictEqual(prompts.length, 1);
	});

	it('recovers an abandoned lock without persisting consent or PAT values', async () => {
		const lockPath = options.lockPath!;
		fs.mkdirSync(lockPath);
		fs.mkdirSync(`${lockPath}.lock`);
		const stale = new Date(Date.now() - 180_000);
		fs.utimesSync(`${lockPath}.lock`, stale, stale);
		await migration().tryMigratePublisher('publisher');
		assert.ok(!fs.existsSync(`${lockPath}.lock`));
		assert.deepStrictEqual(fs.readdirSync(lockPath), []);
	});
});

class MemoryStore implements IStore {
	private readonly snapshot: Map<string, string>;

	constructor(private readonly passwords: Map<string, string>, private readonly writes: string[]) {
		this.snapshot = new Map(passwords);
	}

	get size(): number { return this.snapshot.size; }

	get(name: string): IPublisher | undefined {
		const pat = this.snapshot.get(name);
		return pat === undefined ? undefined : { name, pat };
	}

	async add(publisher: IPublisher): Promise<void> {
		this.writes.push(publisher.name);
		this.passwords.set(publisher.name, publisher.pat);
		this.snapshot.set(publisher.name, publisher.pat);
	}

	async delete(name: string): Promise<void> {
		this.passwords.delete(name);
		this.snapshot.delete(name);
	}

	*[Symbol.iterator](): Iterator<IPublisher> {
		for (const [name, pat] of this.snapshot) {
			yield { name, pat };
		}
	}
}
