import * as assert from 'assert';
import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { setImmediate } from 'timers/promises';
import { lintFiles, lintText } from '../secretLint';

const { privateKey } = generateKeyPairSync('ec', {
	namedCurve: 'prime256v1',
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const privateKeyRule = '@secretlint/secretlint-rule-preset-recommend > @secretlint/secretlint-rule-privatekey';
const dotenvRule = '@secretlint/secretlint-rule-no-dotenv';

async function assertNoProfiling(scan: () => Promise<void>): Promise<void> {
	const profilerPackage = '@secretlint/profiler';
	const { secretLintProfiler }: {
		secretLintProfiler: {
			readonly isEnabled: boolean;
			setEnabled(enabled: boolean): void;
		};
	} = await import(profilerPackage);
	const wasEnabled = secretLintProfiler.isEnabled;
	secretLintProfiler.setEnabled(true);
	const names: string[] = [];
	const marker = 'vsce-secret-scanning-test';
	const observer = new PerformanceObserver(entries => {
		names.push(...entries.getEntries().map(entry => entry.name));
	});
	observer.observe({ entryTypes: ['mark', 'measure'] });

	try {
		await scan();
		performance.mark(marker);
		await setImmediate();
		await setImmediate();
		assert.ok(names.includes(marker), 'Unrelated performance marks should still be observable');
		assert.deepStrictEqual(names.filter(name => name.startsWith('@core>')), []);
	} finally {
		observer.disconnect();
		performance.clearMarks(marker);
		secretLintProfiler.setEnabled(wasEnabled);
	}
}

describe('Secret scanning', () => {
	it('ignores placeholder private keys and malformed npm tokens', async () => {
		const placeholder = `-----BEGIN RSA PRIVATE KEY-----\n${'A'.repeat(64)}\n-----END RSA PRIVATE KEY-----`;
		for (const content of [placeholder, `npm_${'A'.repeat(41)}`]) {
			assert.deepStrictEqual(await lintText(content, 'fixture.txt', true, true), { ok: true, results: [] });
		}
	});

	it('detects newly recommended secret types unless secret scanning is disabled', async () => {
		const stripeKey = `sk_test_${'A'.repeat(24)}`;
		const result = await lintText(stripeKey, 'fixture.txt', true, false);
		assert.strictEqual(result.ok, false);
		assert.deepStrictEqual(result.results.map(finding => finding.ruleId), [
			'@secretlint/secretlint-rule-preset-recommend > @secretlint/secretlint-rule-stripe',
		]);
		assert.deepStrictEqual(await lintText(stripeKey, 'fixture.txt', false, false), { ok: true, results: [] });
	});

	it('scans in-memory content without collecting unused profiling entries', async () => {
		await assertNoProfiling(async () => {
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
	});

	it('scans files without collecting unused profiling entries', async () => {
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
			await assertNoProfiling(async () => {
				const result = await lintFiles([cleanPath, secretPath, dotenvPath], true, true);
				assert.strictEqual(result.ok, false);
				assert.deepStrictEqual(result.results.map(finding => finding.ruleId), [privateKeyRule, dotenvRule]);
				assert.deepStrictEqual(await lintFiles([secretPath, dotenvPath], false, false), { ok: true, results: [] });
			});
		} finally {
			await fs.promises.rm(directory, { recursive: true, force: true });
		}
	});
});
