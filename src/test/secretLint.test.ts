import * as assert from 'assert';
import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getRuleNameFromRuleId, lintFiles, lintText } from '../secretLint';

const { privateKey } = generateKeyPairSync('ec', {
	namedCurve: 'prime256v1',
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const privateKeyRule = '@secretlint/secretlint-rule-preset-recommend > @secretlint/secretlint-rule-privatekey';
const dotenvRule = '@secretlint/secretlint-rule-no-dotenv';

describe('Secret scanning', () => {
	it('ignores placeholder private keys and malformed npm tokens', async () => {
		const placeholder = `-----BEGIN RSA PRIVATE KEY-----\n${'A'.repeat(64)}\n-----END RSA PRIVATE KEY-----`;
		for (const content of [placeholder, `npm_${'A'.repeat(41)}`]) {
			assert.deepStrictEqual(await lintText(content, 'fixture.txt', true, true), { ok: true, results: [] });
		}
	});

	it('detects newly recommended secret types unless secret scanning is disabled', async () => {
		const stripeKey = `sk_test_${'a1B2c3D4'.repeat(3)}`;
		const result = await lintText(stripeKey, 'fixture.txt', true, false);
		assert.strictEqual(result.ok, false);
		assert.deepStrictEqual(result.results.map(finding => finding.ruleId), [
			'@secretlint/secretlint-rule-preset-recommend > @secretlint/secretlint-rule-stripe',
		]);
		assert.deepStrictEqual(await lintText(stripeKey, 'fixture.txt', false, false), { ok: true, results: [] });
	});

	it('allows placeholder tokens that repeat a character', async () => {
		for (const content of [`sk_live_${'x'.repeat(24)}`, `glpat-${'x'.repeat(20)}`, `hf_${'x'.repeat(34)}`, `npm_${'0'.repeat(36)}`]) {
			assert.deepStrictEqual(await lintText(content, 'README.md', true, false), { ok: true, results: [] }, content);
		}
		const result = await lintText(`glpat-${'aB3dE5gH7jK9mN1pQ3sT'}`, 'README.md', true, false);
		assert.deepStrictEqual(result.results.map(finding => getRuleNameFromRuleId(finding.ruleId)), ['gitlab']);
	});

	it('detects each private key once, including formats the recommended rules skip', async () => {
		const publicKeyEncoding = { type: 'spki', format: 'pem' } as const;
		const keys = {
			'RSA PKCS#8': generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }).privateKey,
			'EC SEC1': generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding, privateKeyEncoding: { type: 'sec1', format: 'pem' } }).privateKey,
			'Ed25519 PKCS#8': generateKeyPairSync('ed25519', { publicKeyEncoding, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }).privateKey,
			'encrypted PKCS#8': generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding, privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'fixture' } }).privateKey,
		};
		for (const [name, key] of Object.entries(keys)) {
			const result = await lintText(key, 'fixture.pem', true, false);
			assert.strictEqual(result.ok, false, name);
			assert.deepStrictEqual(result.results.map(finding => getRuleNameFromRuleId(finding.ruleId)), ['privatekey'], name);
		}
	});

	it('allows placeholder and local database URLs', async () => {
		for (const content of [
			'mysql://[<user>[:<password>]@]<host>[:<port>]/[<db>]',
			'mongodb+srv://myUser:<db_password>@cluster0.example.mongodb.net/',
			'postgres://postgres:mysecretpassword@localhost:5432/postgres',
		]) {
			assert.deepStrictEqual(await lintText(content, 'fixture.md', true, false), { ok: true, results: [] }, content);
		}
		const result = await lintText('postgres://app:S3cretPassw0rd@db.example.net:5432/app', 'fixture.ts', true, false);
		assert.deepStrictEqual(result.results.map(finding => getRuleNameFromRuleId(finding.ruleId)), ['database-connection-string']);
	});

	it('scans in-memory content concurrently', async () => {
		const [clean, secret, dotenv, disabled] = await Promise.all([
			lintText('export const value = 1;\n', 'fixture.js', true, true),
			lintText(privateKey, 'fixture.key', true, false),
			lintText('TEST_SETTING=fixture\n', 'fixture/.env', false, true),
			lintText(privateKey, 'fixture.key', false, false),
		]);
		assert.deepStrictEqual(clean, { ok: true, results: [] });
		assert.strictEqual(secret.ok, false);
		assert.deepStrictEqual(secret.results.map(result => result.ruleId), [privateKeyRule]);
		assert.strictEqual(dotenv.ok, false);
		assert.deepStrictEqual(dotenv.results.map(result => result.ruleId), [dotenvRule]);
		assert.deepStrictEqual(disabled, { ok: true, results: [] });
	});

	it('scans files', async () => {
		const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsce-secretlint-'));
		const cleanPath = path.join(directory, 'fixture.js');
		const secretPath = path.join(directory, 'fixture.key');
		const dotenvPath = path.join(directory, '.env');

		try {
			await Promise.all([
				fs.promises.writeFile(cleanPath, 'export const value = 1;\n'),
				fs.promises.writeFile(secretPath, privateKey),
				fs.promises.writeFile(dotenvPath, 'TEST_SETTING=fixture\n'),
			]);
			const result = await lintFiles([cleanPath, secretPath, dotenvPath], true, true);
			assert.strictEqual(result.ok, false);
			assert.deepStrictEqual(result.results.map(finding => finding.ruleId), [privateKeyRule, dotenvRule]);
			assert.deepStrictEqual(await lintFiles([secretPath, dotenvPath], false, false), { ok: true, results: [] });
		} finally {
			await fs.promises.rm(directory, { recursive: true, force: true });
		}
	});
});
