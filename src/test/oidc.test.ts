import * as assert from 'assert';
import {
	getOIDCCredential,
	IOIDCHttpRequest,
	IOIDCHttpResponse,
	OIDC_AUDIENCE,
	OIDCHttpRequestHandler,
} from '../oidc';
import { getPAT } from '../publish';

interface RecordedRequest {
	readonly url: string;
	readonly request: IOIDCHttpRequest;
}

describe('OIDC trusted publishing', () => {
	it('requests a GitHub Actions token and exchanges it for a Marketplace credential', async () => {
		const requests: RecordedRequest[] = [];
		const request = createRequestHandler(
			requests,
			response({ value: 'github-oidc-token' }),
			response({
				credential: 'marketplace-session-token',
				expires: '2026-05-22T16:30:00Z',
				publisherName: 'my-publisher',
			})
		);

		const credential = await getOIDCCredential('my-publisher', {
			environment: {
				GITHUB_ACTIONS: 'true',
				ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.example/id-token?api-version=1',
				ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'github-runtime-token',
			},
			marketplaceUrl: 'https://marketplace.example',
			request,
		});

		assert.strictEqual(credential, 'marketplace-session-token');
		assert.strictEqual(requests.length, 2);

		const githubRequestUrl = new URL(requests[0].url);
		assert.strictEqual(githubRequestUrl.searchParams.get('api-version'), '1');
		assert.strictEqual(githubRequestUrl.searchParams.get('audience'), OIDC_AUDIENCE);
		assert.deepStrictEqual(requests[0].request, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				Authorization: 'Bearer github-runtime-token',
			},
		});

		assert.strictEqual(requests[1].url, 'https://marketplace.example/_apis/gallery/token');
		assert.deepStrictEqual(requests[1].request, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				Authorization: 'Bearer github-oidc-token',
				'Content-Type': 'application/json',
				'User-Agent': 'vsce',
			},
			body: JSON.stringify({ publisherName: 'my-publisher' }),
		});
	});

	it('explains how to enable GitHub Actions OIDC token requests', async () => {
		await assert.rejects(
			getOIDCCredential('my-publisher', {
				environment: { GITHUB_ACTIONS: 'true' },
				request: unexpectedRequest,
			}),
			/id-token: write/
		);
	});

	it('rejects unsupported environments', async () => {
		await assert.rejects(
			getOIDCCredential('my-publisher', {
				environment: {},
				request: unexpectedRequest,
			}),
			/OIDC publishing currently supports GitHub Actions only/
		);
	});

	it('surfaces Marketplace token exchange errors without falling back', async () => {
		const request = createRequestHandler(
			[],
			response({ value: 'github-oidc-token' }),
			response({ message: 'No matching trusted publishing policy.' }, 401, 'Unauthorized')
		);

		await assert.rejects(
			getOIDCCredential('my-publisher', {
				environment: {
					GITHUB_ACTIONS: 'true',
					ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.example/id-token',
					ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'github-runtime-token',
				},
				marketplaceUrl: 'https://marketplace.example/',
				request,
			}),
			/Marketplace OIDC token exchange failed with 401 Unauthorized: No matching trusted publishing policy/
		);
	});

	it('rejects malformed successful exchange responses', async () => {
		const request = createRequestHandler(
			[],
			response({ value: 'github-oidc-token' }),
			response({ expires: '2026-05-22T16:30:00Z' })
		);

		await assert.rejects(
			getOIDCCredential('my-publisher', {
				environment: {
					GITHUB_ACTIONS: 'true',
					ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.example/id-token',
					ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'github-runtime-token',
				},
				request,
			}),
			/invalid response without a credential/
		);
	});

	it('rejects OIDC combined with another authentication method', async () => {
		await assert.rejects(getPAT('my-publisher', { oidc: true, pat: 'pat' }), /'--oidc' and '--pat'/);
		await assert.rejects(
			getPAT('my-publisher', { oidc: true, azureCredential: true }),
			/'--oidc' and '--azure-credential'/
		);
	});
});

function createRequestHandler(
	requests: RecordedRequest[],
	...responses: IOIDCHttpResponse[]
): OIDCHttpRequestHandler {
	return async (url, request) => {
		requests.push({ url, request });
		const nextResponse = responses.shift();
		assert.ok(nextResponse, 'Unexpected HTTP request');
		return nextResponse;
	};
}

function response(body: unknown, statusCode = 200, statusMessage = 'OK'): IOIDCHttpResponse {
	return {
		statusCode,
		statusMessage,
		readBody: async () => JSON.stringify(body),
	};
}

async function unexpectedRequest(): Promise<IOIDCHttpResponse> {
	throw new Error('Unexpected HTTP request');
}
