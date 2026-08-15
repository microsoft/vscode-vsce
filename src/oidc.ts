import { getMarketplaceUrl } from './util';

export const OIDC_AUDIENCE = 'marketplace.visualstudio.com';

export interface IOIDCHttpRequest {
	readonly method: 'GET' | 'POST';
	readonly headers: Readonly<Record<string, string>>;
	readonly body?: string;
}

export interface IOIDCHttpResponse {
	readonly statusCode: number;
	readonly statusMessage: string;
	readBody(): Promise<string>;
}

export type OIDCHttpRequestHandler = (url: string, request: IOIDCHttpRequest) => Promise<IOIDCHttpResponse>;

interface IOIDCTokenProviderContext {
	readonly environment: NodeJS.ProcessEnv;
	readonly request: OIDCHttpRequestHandler;
}

interface IOIDCTokenProvider {
	readonly name: string;
	isAvailable(environment: NodeJS.ProcessEnv): boolean;
	getToken(audience: string, context: IOIDCTokenProviderContext): Promise<string>;
}

class GitHubActionsOIDCTokenProvider implements IOIDCTokenProvider {
	readonly name = 'GitHub Actions';

	isAvailable(environment: NodeJS.ProcessEnv): boolean {
		return environment['GITHUB_ACTIONS']?.toLowerCase() === 'true';
	}

	async getToken(audience: string, { environment, request }: IOIDCTokenProviderContext): Promise<string> {
		const requestUrl = environment['ACTIONS_ID_TOKEN_REQUEST_URL'];
		const requestToken = environment['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];

		if (!requestUrl || !requestToken) {
			throw new Error(
				'GitHub Actions did not provide an OIDC token request URL and token. Add `permissions: id-token: write` to the workflow or job.'
			);
		}

		let tokenUrl: URL;
		try {
			tokenUrl = new URL(requestUrl);
		} catch {
			throw new Error('GitHub Actions provided an invalid ACTIONS_ID_TOKEN_REQUEST_URL.');
		}
		tokenUrl.searchParams.set('audience', audience);

		const result = await requestJSON('GitHub Actions OIDC token request', tokenUrl.toString(), request, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${requestToken}`,
			},
		});

		if (!isRecord(result) || typeof result.value !== 'string' || !result.value) {
			throw new Error('GitHub Actions OIDC token request returned an invalid response without a token.');
		}

		return result.value;
	}
}

const oidcTokenProviders: readonly IOIDCTokenProvider[] = [new GitHubActionsOIDCTokenProvider()];

export interface IGetOIDCCredentialOptions {
	readonly environment?: NodeJS.ProcessEnv;
	readonly marketplaceUrl?: string;
	readonly request?: OIDCHttpRequestHandler;
}

export async function getOIDCCredential(
	publisherName: string,
	options: IGetOIDCCredentialOptions = {}
): Promise<string> {
	const environment = options.environment ?? process.env;
	const request = options.request ?? defaultRequest;
	const provider = oidcTokenProviders.find(candidate => candidate.isAvailable(environment));

	if (!provider) {
		throw new Error('No supported OIDC provider was detected. OIDC publishing currently supports GitHub Actions only.');
	}

	const oidcToken = await provider.getToken(OIDC_AUDIENCE, { environment, request });
	return await exchangeOIDCToken(publisherName, oidcToken, options.marketplaceUrl ?? getMarketplaceUrl(), request);
}

async function exchangeOIDCToken(
	publisherName: string,
	oidcToken: string,
	marketplaceUrl: string,
	request: OIDCHttpRequestHandler
): Promise<string> {
	const result = await requestJSON(
		'Marketplace OIDC token exchange',
		`${marketplaceUrl.replace(/\/$/, '')}/_apis/gallery/token`,
		request,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${oidcToken}`,
				'Content-Type': 'application/json',
				'User-Agent': 'vsce',
			},
			body: JSON.stringify({ publisherName }),
		}
	);

	if (!isRecord(result) || typeof result.credential !== 'string' || !result.credential) {
		throw new Error('Marketplace OIDC token exchange returned an invalid response without a credential.');
	}

	return result.credential;
}

async function defaultRequest(url: string, request: IOIDCHttpRequest): Promise<IOIDCHttpResponse> {
	const response = await fetch(url, request);
	return {
		statusCode: response.status,
		statusMessage: response.statusText,
		readBody: () => response.text(),
	};
}

async function requestJSON(
	operation: string,
	url: string,
	request: OIDCHttpRequestHandler,
	init: IOIDCHttpRequest
): Promise<unknown> {
	let response: IOIDCHttpResponse;
	try {
		response = await request(url, init);
	} catch (error) {
		throw new Error(`${operation} failed: ${getErrorMessage(error)}`);
	}

	let body: string;
	try {
		body = await response.readBody();
	} catch (error) {
		throw new Error(`${operation} failed while reading the response: ${getErrorMessage(error)}`);
	}

	if (response.statusCode < 200 || response.statusCode >= 300) {
		const status = `${response.statusCode}${response.statusMessage ? ` ${response.statusMessage}` : ''}`;
		throw new Error(`${operation} failed with ${status}${getResponseDetails(body)}`);
	}

	try {
		return JSON.parse(body);
	} catch {
		throw new Error(`${operation} returned an invalid JSON response.`);
	}
}

function getResponseDetails(body: string): string {
	const trimmedBody = body.trim();
	if (!trimmedBody) {
		return '.';
	}

	try {
		const parsed: unknown = JSON.parse(trimmedBody);
		if (isRecord(parsed)) {
			const message = parsed.message ?? parsed.error_description ?? parsed.error;
			if (typeof message === 'string' && message) {
				return `: ${message}`;
			}
		}
	} catch {
		// Use the plain response body below.
	}

	return `: ${trimmedBody.slice(0, 500)}`;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
