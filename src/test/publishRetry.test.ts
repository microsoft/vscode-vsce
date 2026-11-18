import * as assert from 'assert';
import { IRetryBackoffContext } from 'cockatiel';
import {
	MAX_RETRY_AFTER_MS,
	createRetryBackoff,
	getRetryAfterMs,
	isRetryableError,
	uploadWithRetry,
	withRetry,
} from '../publishRetry';

const NO_DELAYS = [0, 0, 0];

function httpError(statusCode: number, retryAfter?: string): Error {
	const responseHeaders = retryAfter === undefined ? {} : { 'retry-after': retryAfter };
	return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode, responseHeaders });
}

function failure(error: Error, attempt = 1): IRetryBackoffContext<unknown> {
	return { attempt, signal: new AbortController().signal, result: { error } };
}

/** Duration of the backoff cockatiel would use before retry number `attempt`. */
function backoffDuration(delays: number[], error: Error, attempt = 1, random = () => 0.5): number {
	return createRetryBackoff(delays, random).next(failure(error, attempt)).duration;
}

const timeoutError = () => new Error('Request timeout: /_apis/gallery/publishers/pub/extensions/ext');

describe('isRetryableError', () => {
	it('retries socket timeouts and transient network errors', () => {
		assert.ok(isRetryableError(timeoutError()));
		assert.ok(isRetryableError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })));
		assert.ok(isRetryableError(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })));
	});

	it('retries throttling and gateway errors', () => {
		for (const statusCode of [408, 429, 502, 503, 504]) {
			assert.ok(isRetryableError(httpError(statusCode)), `${statusCode}`);
		}
	});

	it('does not retry client or conflict errors', () => {
		for (const statusCode of [400, 401, 403, 404, 409, 500]) {
			assert.ok(!isRetryableError(httpError(statusCode)), `${statusCode}`);
		}
	});

	it('does not retry errors that merely mention a timeout', () => {
		assert.ok(!isRetryableError(new Error('Invalid timeout value in manifest')));
		assert.ok(!isRetryableError(Object.assign(new Error('timeout'), { statusCode: 400 })));
		assert.ok(!isRetryableError(undefined));
	});
});

describe('getRetryAfterMs', () => {
	const now = Date.parse('2026-10-19T12:00:00Z');

	it('parses delta-seconds', () => {
		assert.strictEqual(getRetryAfterMs(httpError(429, '30'), now), 30_000);
		assert.strictEqual(getRetryAfterMs(httpError(503, '0'), now), 0);
	});

	it('parses an HTTP-date', () => {
		assert.strictEqual(getRetryAfterMs(httpError(429, 'Mon, 19 Oct 2026 12:00:45 GMT'), now), 45_000);
	});

	it('caps large values', () => {
		assert.strictEqual(getRetryAfterMs(httpError(429, '3600'), now), MAX_RETRY_AFTER_MS);
	});

	it('ignores missing, invalid, negative and past values', () => {
		assert.strictEqual(getRetryAfterMs(httpError(429), now), undefined);
		assert.strictEqual(getRetryAfterMs(httpError(429, ''), now), undefined);
		assert.strictEqual(getRetryAfterMs(httpError(429, 'soon'), now), undefined);
		assert.strictEqual(getRetryAfterMs(httpError(429, '-5'), now), undefined);
		assert.strictEqual(getRetryAfterMs(httpError(429, 'Mon, 19 Oct 2026 11:00:00 GMT'), now), undefined);
	});

	it('only applies to 429 and 503', () => {
		assert.strictEqual(getRetryAfterMs(httpError(502, '30'), now), undefined);
		assert.strictEqual(getRetryAfterMs(timeoutError(), now), undefined);
	});
});

describe('createRetryBackoff', () => {
	it('follows the schedule and repeats the last delay', () => {
		const durations = [1, 2, 3].map(attempt => backoffDuration([5_000, 10_000], timeoutError(), attempt));

		assert.deepStrictEqual(durations, [5_000, 10_000, 10_000]);
	});

	it('advances through the schedule when driven by cockatiel', () => {
		const first = createRetryBackoff([5_000, 10_000], () => 0.5).next(failure(timeoutError(), 1));
		const second = first.next(failure(timeoutError(), 2));

		assert.deepStrictEqual([first.duration, second.duration], [5_000, 10_000]);
	});

	it('applies ±20% jitter', () => {
		assert.strictEqual(backoffDuration([10_000], timeoutError(), 1, () => 0), 8_000);
		assert.strictEqual(backoffDuration([10_000], timeoutError(), 1, () => 0.999_999), 12_000);
	});

	it('stays within the jitter bounds with Math.random', () => {
		for (let i = 0; i < 100; i++) {
			const duration = createRetryBackoff([10_000]).next(failure(timeoutError())).duration;
			assert.ok(duration >= 8_000 && duration <= 12_000, `${duration}`);
		}
	});

	it('waits for Retry-After when it is longer than the jittered delay', () => {
		assert.strictEqual(backoffDuration([5_000], httpError(429, '30'), 1, () => 0.999_999), 30_000);
	});

	it('never waits less than the jittered delay', () => {
		assert.strictEqual(backoffDuration([5_000], httpError(429, '1'), 1, () => 0), 4_000);
	});
});

describe('uploadWithRetry', () => {
	it('honors Retry-After on a 429', async function () {
		this.timeout(5_000);
		let uploads = 0;
		const start = Date.now();

		const result = await uploadWithRetry(
			'pub.ext v1.0.0',
			async () => {
				if (++uploads === 1) {
					throw httpError(429, '1');
				}
			},
			async () => false,
			NO_DELAYS
		);

		assert.strictEqual(result, 'published');
		assert.strictEqual(uploads, 2);
		assert.ok(Date.now() - start >= 950, 'waited for Retry-After');
	});

	it('does not check publication state when the first attempt succeeds', async () => {
		let uploads = 0;
		let checks = 0;

		const result = await uploadWithRetry(
			'pub.ext v1.0.0',
			async () => { uploads++; },
			async () => { checks++; return false; },
			NO_DELAYS
		);

		assert.strictEqual(result, 'published');
		assert.strictEqual(uploads, 1);
		assert.strictEqual(checks, 0);
	});

	it('retries after a timeout and succeeds', async () => {
		let uploads = 0;

		const result = await uploadWithRetry(
			'pub.ext v1.0.0',
			async () => {
				if (++uploads === 1) {
					throw timeoutError();
				}
			},
			async () => false,
			NO_DELAYS
		);

		assert.strictEqual(result, 'published');
		assert.strictEqual(uploads, 2);
	});

	it('does not upload again when the timed out attempt was accepted', async () => {
		let uploads = 0;

		const result = await uploadWithRetry(
			'pub.ext v1.0.0',
			async () => { uploads++; throw timeoutError(); },
			async () => true,
			NO_DELAYS
		);

		assert.strictEqual(result, 'alreadyPublished');
		assert.strictEqual(uploads, 1);
	});

	it('treats a conflict on a retry as the earlier attempt having succeeded', async () => {
		let uploads = 0;

		const result = await uploadWithRetry(
			'pub.ext v1.0.0',
			async () => {
				throw ++uploads === 1 ? timeoutError() : httpError(409);
			},
			async () => false,
			NO_DELAYS
		);

		assert.strictEqual(result, 'alreadyPublished');
		assert.strictEqual(uploads, 2);
	});

	it('propagates a conflict on the first attempt', async () => {
		let uploads = 0;

		await assert.rejects(
			uploadWithRetry('pub.ext v1.0.0', async () => { uploads++; throw httpError(409); }, async () => false, NO_DELAYS),
			(err: any) => err.statusCode === 409
		);
		assert.strictEqual(uploads, 1);
	});

	it('does not retry non-transient errors', async () => {
		let uploads = 0;

		await assert.rejects(
			uploadWithRetry('pub.ext v1.0.0', async () => { uploads++; throw httpError(401); }, async () => false, NO_DELAYS),
			(err: any) => err.statusCode === 401
		);
		assert.strictEqual(uploads, 1);
	});

	it('gives up after the configured number of retries', async () => {
		let uploads = 0;
		let checks = 0;

		await assert.rejects(
			uploadWithRetry(
				'pub.ext v1.0.0',
				async () => { uploads++; throw timeoutError(); },
				async () => { checks++; return false; },
				NO_DELAYS
			),
			/Request timeout/
		);
		assert.strictEqual(uploads, NO_DELAYS.length + 1);
		assert.strictEqual(checks, NO_DELAYS.length);
	});

	it('retries when the publication check itself times out', async () => {
		let uploads = 0;
		let checks = 0;

		const result = await uploadWithRetry(
			'pub.ext v1.0.0',
			async () => {
				if (++uploads === 1) {
					throw timeoutError();
				}
			},
			async () => {
				if (++checks === 1) {
					throw timeoutError();
				}
				return false;
			},
			NO_DELAYS
		);

		assert.strictEqual(result, 'published');
		assert.strictEqual(uploads, 2);
		assert.strictEqual(checks, 2);
	});
});

describe('withRetry', () => {
	it('retries a transient failure and returns the result', async () => {
		const attempts: number[] = [];

		const result = await withRetry(
			`Looking up 'pub.ext'`,
			async attempt => {
				attempts.push(attempt);
				if (attempt === 0) {
					throw httpError(503);
				}
				return 'extension';
			},
			NO_DELAYS
		);

		assert.strictEqual(result, 'extension');
		assert.deepStrictEqual(attempts, [0, 1]);
	});

	it('does not retry non-transient errors', async () => {
		let calls = 0;

		await assert.rejects(
			withRetry(`Looking up 'pub.ext'`, async () => { calls++; throw httpError(401); }, NO_DELAYS),
			(err: any) => err.statusCode === 401
		);
		assert.strictEqual(calls, 1);
	});

	it('gives up after the configured number of retries', async () => {
		let calls = 0;

		await assert.rejects(
			withRetry(`Looking up 'pub.ext'`, async () => { calls++; throw timeoutError(); }, NO_DELAYS),
			/Request timeout/
		);
		assert.strictEqual(calls, NO_DELAYS.length + 1);
	});
});
