import * as _read from 'read';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';
import { IGalleryApi } from 'vso-node-api/GalleryApi';
import * as denodeify from 'denodeify';
import { PublicGalleryAPI } from './publicgalleryapi';
import { ISecurityRolesApi } from 'vso-node-api/SecurityRolesApi';

const __read = denodeify<_read.Options, string>(_read);
export function read(prompt: string, options: _read.Options = {}): Promise<string> {
	if (process.env['VSCE_TESTS'] || !process.stdout.isTTY) {
		return Promise.resolve('y');
	}

	return __read({ prompt, ...options });
}

const marketplaceUrl = process.env['VSCE_MARKETPLACE_URL'] || 'https://marketplace.visualstudio.com';

export function getPublishedUrl(extension: string): string {
	return `${marketplaceUrl}/items?itemName=${extension}`;
}

export function getGalleryAPI(pat: string): IGalleryApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getGalleryApi(marketplaceUrl);
}

export function getSecurityRolesAPI(pat: string): ISecurityRolesApi {
	const authHandler = getBasicHandler('oauth', pat);
	const vsoapi = new WebApi('oauth', authHandler);
	return vsoapi.getSecurityRolesApi(marketplaceUrl);
}

export function getPublicGalleryAPI() {
	return new PublicGalleryAPI(marketplaceUrl, '3.0-preview.1');
}

export function normalize(path: string): string {
	return path.replace(/\\/g, '/');
}

function chain2<A, B>(a: A, b: B[], fn: (a: A, b: B) => Promise<A>, index = 0): Promise<A> {
	if (index >= b.length) {
		return Promise.resolve(a);
	}

	return fn(a, b[index]).then(a => chain2(a, b, fn, index + 1));
}

export function chain<T, P>(initial: T, processors: P[], process: (a: T, b: P) => Promise<T>): Promise<T> {
	return chain2(initial, processors, process);
}

export function flatten<T>(arr: T[][]): T[] {
	return [].concat.apply([], arr) as T[];
}

const CancelledError = 'Cancelled';

export function isCancelledError(error: any) {
	return error === CancelledError;
}

export class CancellationToken {

	private listeners: Function[] = [];
	private _cancelled: boolean = false;
	get isCancelled(): boolean { return this._cancelled; }

	subscribe(fn: Function): Function {
		this.listeners.push(fn);

		return () => {
			const index = this.listeners.indexOf(fn);

			if (index > -1) {
				this.listeners.splice(index, 1);
			}
		};
	}

	cancel(): void {
		const emit = !this._cancelled;
		this._cancelled = true;

		if (emit) {
			this.listeners.forEach(l => l(CancelledError));
			this.listeners = [];
		}
	}
}

export async function sequence(promiseFactories: { (): Promise<any> }[]): Promise<void> {
	for (const factory of promiseFactories) {
		await factory();
	}
}