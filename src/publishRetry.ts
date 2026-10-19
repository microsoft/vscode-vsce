import { DelegateBackoff, IRetryBackoffContext, handleWhen, retry } from 'cockatiel';
import { log } from './util';

/**
 * Delays between Marketplace request attempts. One initial attempt plus one retry per entry.
 */
export const DEFAULT_RETRY_DELAYS: readonly number[] = [5_000, 10_000, 20_000];

/**
 * Upper bound for a server-provided Retry-After, so a large value cannot stall CI.
 */
export const MAX_RETRY_AFTER_MS = 120_000;

/**
 * Reads the Retry-After header (delta-seconds or HTTP-date) of a 429 or 503 error,
 * in milliseconds and capped at {@link MAX_RETRY_AFTER_MS}.
 */
export function getRetryAfterMs(err: any, now: number = Date.now()): number | undefined {
	if (err?.statusCode !== 429 && err?.statusCode !== 503) {
		return undefined;
	}

	// typed-rest-client exposes the (lowercased) response headers on HTTP errors.
	const value = err.responseHeaders?.['retry-after'];

	if (typeof value !== 'string' || value.trim() === '') {
		return undefined;
	}

	const seconds = Number(value);
	const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;

	return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : undefined;
}

/**
 * Fraction by which each scheduled delay is randomized, so parallel publish jobs
 * that fail together do not retry in lockstep.
 */
export const RETRY_JITTER = 0.2;

/**
 * Follows the scheduled delays with ±{@link RETRY_JITTER} jitter, but waits at least as
 * long as the server's Retry-After, which is not jittered.
 *
 * `random` returns a number in [0, 1) and can be replaced for deterministic tests.
 */
export function createRetryBackoff(
	delays: readonly number[],
	random: () => number = Math.random
): DelegateBackoff<IRetryBackoffContext<unknown>> {
	return new DelegateBackoff<IRetryBackoffContext<unknown>>(({ attempt, result }) => {
		// The backoff context's attempt is 1-based.
		const scheduled = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
		const jittered = Math.round(scheduled * (1 - RETRY_JITTER + 2 * RETRY_JITTER * random()));
		const retryAfter = 'error' in result ? getRetryAfterMs(result.error) : undefined;

		return Math.max(jittered, retryAfter ?? 0);
	});
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPIPE', 'EAI_AGAIN']);

/**
 * Whether a failed Marketplace request is transient and worth retrying. Authentication,
 * validation and conflict errors are not.
 */
export function isRetryableError(err: any): boolean {
	if (!err) {
		return false;
	}

	if (typeof err.statusCode === 'number') {
		return RETRYABLE_STATUS_CODES.has(err.statusCode);
	}

	if (typeof err.code === 'string' && RETRYABLE_ERROR_CODES.has(err.code)) {
		return true;
	}

	// azure-devops-node-api reports its socket timeout as a plain Error.
	return typeof err.message === 'string' && err.message.startsWith('Request timeout:');
}

/**
 * Runs `fn`, retrying transient Marketplace failures and logging each retry.
 *
 * `operation` describes the request in the retry warning, e.g. `Publishing 'pub.ext v1.0.0'`.
 * `fn` receives the zero-based attempt number.
 */
export async function withRetry<T>(
	operation: string,
	fn: (attempt: number) => Promise<T>,
	delays: readonly number[] = DEFAULT_RETRY_DELAYS
): Promise<T> {
	const policy = retry(handleWhen(isRetryableError), {
		maxAttempts: delays.length,
		backoff: createRetryBackoff(delays),
	});

	const totalAttempts = delays.length + 1;
	const listener = policy.onRetry(event => {
		const reason = 'error' in event ? (event.error as any)?.message ?? String(event.error) : 'unknown error';
		log.warn(
			`${operation} failed: ${reason}. Retrying in ${(event.delay / 1000).toFixed(1)}s (attempt ${event.attempt + 1} of ${totalAttempts})...`
		);
	});

	try {
		return await policy.execute(({ attempt }) => fn(attempt));
	} finally {
		listener.dispose();
	}
}

export type UploadResult = 'published' | 'alreadyPublished';

/**
 * Runs `upload`, retrying transient failures.
 *
 * A timed out upload may still have been accepted by the Marketplace, so before
 * every retry `isPublished` is consulted, and a 409 conflict on a retry is
 * treated as the earlier attempt having succeeded.
 *
 * `upload` is invoked once per attempt and must create a fresh request body each time.
 */
export async function uploadWithRetry(
	description: string,
	upload: () => Promise<unknown>,
	isPublished: () => Promise<boolean>,
	delays: readonly number[] = DEFAULT_RETRY_DELAYS
): Promise<UploadResult> {
	return withRetry<UploadResult>(
		`Publishing '${description}'`,
		async attempt => {
			const isRetry = attempt > 0;

			if (isRetry && (await isPublished())) {
				return 'alreadyPublished';
			}

			try {
				await upload();
				return 'published';
			} catch (err: any) {
				if (isRetry && err?.statusCode === 409) {
					return 'alreadyPublished';
				}

				throw err;
			}
		},
		delays
	);
}
