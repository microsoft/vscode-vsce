import * as assert from 'assert';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { homedir, tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { LegacyCredentialMigration } from '../keytarMigration';
import { LegacyMigrationError, readLegacyCredential } from '../legacyCredentials';
import { IKeytar, IPublisher, KeytarStore } from '../store';

const execFileAsync = promisify(execFile);
const windowsFixture = path.join(__dirname, 'fixtures', 'keytar', 'windows.ps1');
type NativeKeyring = IKeytar & { getPassword(service: string, name: string): Promise<string | null | undefined> };

(process.platform === 'win32' ? describe : describe.skip)('Native keytar migration (Windows)', function () {
	this.timeout(60_000);
	let directory: string;
	let service: string;
	let keyring: NativeKeyring;
	let publishers: IPublisher[];
	let prompts: string[];
	let answer: string;

	beforeEach(() => {
		directory = fs.mkdtempSync(path.join(tmpdir(), 'vsce-native-keytar-'));
		service = `vsce-test-keytar-${randomUUID()}`;
		keyring = require('@napi-rs/keyring/keytar.js') as NativeKeyring;
		prompts = [];
		answer = 'y';
		publishers = [
			{ name: 'legacy-odd', pat: 'a'.repeat(51) },
			{ name: 'legacy-even', pat: 'b'.repeat(84) },
			{ name: 'legacy-unicode', pat: 'utf8-\u2603-\ud83d\udd10-"quoted"\n' },
			{ name: 'already-saved', pat: 'stale-pat' },
			{ name: 'case-publisher', pat: 'stale-case-pat' },
		];
	});

	afterEach(async () => {
		try {
			await fixture('cleanup');
			for (const publisher of publishers) {
				await keyring.deletePassword(service, publisher.name);
			}
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	async function fixture(action: string, values = publishers.map(p => ({
		name: p.name, bytes: Buffer.from(p.pat, 'utf8').toString('base64'),
	})), serviceName = service): Promise<string> {
		const { stdout } = await execFileAsync('powershell.exe', [
			'-NoLogo', '-NoProfile', '-NonInteractive', '-File', windowsFixture, action,
		], {
			env: { ...process.env, VSCE_TEST_KEYTAR_SERVICE: serviceName, VSCE_TEST_KEYTAR_PUBLISHERS: JSON.stringify(values) },
			windowsHide: true, timeout: 30_000,
		});
		return stdout;
	}

	async function open(): Promise<LegacyCredentialMigration> {
		return new LegacyCredentialMigration(await KeytarStore.open(service), () => KeytarStore.open(service), {
			serviceName: service,
			lockPath: path.join(directory, 'lock'),
			interactive: true,
			prompt: async question => { prompts.push(question); return answer; },
		});
	}

	it('copies actual UTF-8 keytar entries, preserves newer PATs and leaves old bytes/metadata untouched', async () => {
		await fixture('seed');
		const before: unknown = JSON.parse(await fixture('snapshot'));
		await keyring.setPassword(service, 'already-saved', 'newer-pat');
		await keyring.setPassword(service, 'CASE-PUBLISHER', 'newer-case-pat');
		const store = await open();
		assert.strictEqual(store.size, 2);
		assert.deepStrictEqual(prompts, []);
		for (const publisher of publishers) {
			assert.deepStrictEqual(await readLegacyCredential(service, publisher.name), publisher);
			const expected = publisher.name === 'already-saved' ? 'newer-pat'
				: publisher.name === 'case-publisher' ? 'newer-case-pat' : publisher.pat;
			assert.strictEqual((await store.tryMigratePublisher(publisher.name))?.pat, expected);
			const storedName = publisher.name === 'case-publisher' ? 'CASE-PUBLISHER' : publisher.name;
			assert.strictEqual(store.get(storedName)?.pat, expected);
			assert.strictEqual(await keyring.getPassword(service, publisher.name), expected);
		}

		assert.strictEqual(prompts.length, 3);
		assert.strictEqual((await open()).size, publishers.length);
		await store.delete('legacy-odd');
		const reopened = await open();
		assert.strictEqual(reopened.get('legacy-odd'), undefined);
		answer = 'n';
		assert.strictEqual(await reopened.tryMigratePublisher('legacy-odd'), undefined);
		assert.strictEqual(await keyring.getPassword(service, 'legacy-odd') ?? undefined, undefined);
		assert.strictEqual(prompts.length, 4);
		assert.deepStrictEqual(JSON.parse(await fixture('snapshot')), before);
	});

	it('returns no credentials for an empty service and does not match neighboring service names', async () => {
		const neighboringService = `${service}-a`;
		try {
			await fixture('seed', undefined, neighboringService);
			assert.strictEqual(await readLegacyCredential(service, 'legacy-odd'), undefined);
		} finally {
			await fixture('cleanup', undefined, neighboringService);
		}
	});

	it('rejects invalid UTF-8 safely without altering the legacy entry', async () => {
		await fixture('seed', [{ name: 'legacy-odd', bytes: Buffer.from([0xff]).toString('base64') }]);
		const before: unknown = JSON.parse(await fixture('snapshot'));
		await assert.rejects(readLegacyCredential(service, 'legacy-odd'), (error: Error) => {
			assert.ok(error instanceof LegacyMigrationError);
			assert.ok(!('stdout' in error));
			assert.ok(!('stderr' in error));
			return true;
		});
		assert.deepStrictEqual(JSON.parse(await fixture('snapshot')), before);
	});
});

const testLinux = process.platform === 'linux' && process.env.VSCE_TEST_KEYTAR_LINUX === '1';
(testLinux ? describe : describe.skip)('Native keytar migration (Linux)', function () {
	this.timeout(60_000);
	let directory: string;
	let service: string;
	let keyring: NativeKeyring;
	let publishers: IPublisher[];
	let seeded: boolean;
	let prompts: string[];
	let answer: string;

	before(() => {
		assert.strictEqual(homedir(), process.env.VSCE_TEST_KEYTAR_HOME, 'Use an isolated HOME and dbus-run-session');
		assert.ok(process.env.DBUS_SESSION_BUS_ADDRESS, 'Use an isolated dbus-run-session');
	});

	beforeEach(() => {
		directory = fs.mkdtempSync(path.join(tmpdir(), 'vsce-native-keytar-'));
		service = `vsce-test-keytar-${randomUUID()}`;
		keyring = require('@napi-rs/keyring/keytar.js') as NativeKeyring;
		seeded = false;
		prompts = [];
		answer = 'y';
		publishers = [
			{ name: 'legacy', pat: 'test-pat-with-trailing-newline\n' },
			{ name: 'already-saved', pat: 'stale-pat' },
		];
	});

	afterEach(async () => {
		try {
			if (seeded) {
				await execFileAsync('secret-tool', ['clear', 'service', service], { timeout: 30_000 });
			}
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	async function seed(publisher: IPublisher): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const child = execFile('secret-tool', [
				'store', '--label=vsce migration test', 'service', service, 'account', publisher.name,
				'xdg:schema', 'org.freedesktop.Secret.Generic',
			], { timeout: 30_000 }, error => error ? reject(error) : resolve());
			child.stdin!.end(publisher.pat);
		});
		seeded = true;
	}

	async function open(): Promise<LegacyCredentialMigration> {
		return new LegacyCredentialMigration(await KeytarStore.open(service), () => KeytarStore.open(service), {
			serviceName: service,
			lockPath: path.join(directory, 'lock'),
			interactive: true,
			prompt: async question => { prompts.push(question); return answer; },
		});
	}

	it('copies actual Secret Service entries without changing old attributes or secrets', async () => {
		for (const publisher of publishers) {
			await seed(publisher);
		}
		await keyring.setPassword(service, 'already-saved', 'newer-pat');
		const store = await open();
		assert.strictEqual(store.get('legacy'), undefined);
		assert.strictEqual(prompts.length, 0);
		assert.strictEqual((await store.tryMigratePublisher('legacy'))?.pat, publishers[0].pat);
		assert.strictEqual((await store.tryMigratePublisher('already-saved'))?.pat, 'newer-pat');
		assert.strictEqual(prompts.length, 1);
		assert.strictEqual(store.get('already-saved')?.pat, 'newer-pat');
		assert.strictEqual(await keyring.getPassword(service, 'legacy'), publishers[0].pat);
		assert.strictEqual((await open()).size, 2);
		await store.delete('legacy');
		const reopened = await open();
		assert.strictEqual(reopened.get('legacy'), undefined);
		answer = 'n';
		assert.strictEqual(await reopened.tryMigratePublisher('legacy'), undefined);
		assert.strictEqual(prompts.length, 2);
		for (const publisher of publishers) {
			assert.deepStrictEqual(await readLegacyCredential(service, publisher.name), publisher);
			const { stdout } = await execFileAsync('secret-tool', [
				'lookup', 'service', service, 'account', publisher.name,
			]);
			assert.strictEqual(stdout, publisher.pat);
		}
	});

	it('handles an empty Secret Service result', async () => {
		assert.strictEqual(await readLegacyCredential(service, 'missing'), undefined);
	});
});
