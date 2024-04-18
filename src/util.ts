import { promisify } from 'util';
import _read from 'read';
import { WebApi, getBasicHandler } from 'azure-devops-node-api/WebApi';
import { IGalleryApi, GalleryApi } from 'azure-devops-node-api/GalleryApi';
import chalk from 'chalk';
import { PublicGalleryAPI } from './publicgalleryapi';
import { ISecurityRolesApi } from 'azure-devops-node-api/SecurityRolesApi';
import { Manifest } from './manifest';
import { EOL } from 'os';
import { DefaultAzureCredential } from '@azure/identity';

const __read = promisify<_read.Options, string>(_read);
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

export function getMarketplaceUrl(): string {
	return marketplaceUrl;
}

export function getHubUrl(publisher: string, name: string): string {
	return `${marketplaceUrl}/manage/publishers/${publisher}/extensions/${name}/hub`;
}

export async function getGalleryAPI(pat: string): Promise<IGalleryApi> {
	// from https://github.com/Microsoft/tfs-cli/blob/master/app/exec/extension/default.ts#L287-L292
	const authHandler = getBasicHandler('OAuth', pat);
	return new GalleryApi(marketplaceUrl, [authHandler]);

	// const vsoapi = new WebApi(marketplaceUrl, authHandler);
	// return await vsoapi.getGalleryApi();
}

export async function getSecurityRolesAPI(pat: string): Promise<ISecurityRolesApi> {
	const authHandler = getBasicHandler('OAuth', pat);
	const vsoapi = new WebApi(marketplaceUrl, authHandler);
	return await vsoapi.getSecurityRolesApi();
}

export function getPublicGalleryAPI() {
	return new PublicGalleryAPI(marketplaceUrl, '3.0-preview.1');
}

export async function getAzureCredentialAccessToken(): Promise<string> {
	try {
		const credential = new DefaultAzureCredential();
		const token = await credential.getToken('499b84ac-1321-427f-aa17-267ca6975798/.default');
		return token.token;
	} catch (error) {
		throw new Error('Can not acquire a Microsoft Entra ID access token. Additional information:\n\n' + error)
	}
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
	return ([] as T[]).concat.apply([], arr) as T[];
}

export function nonnull<T>(arg: T | null | undefined): arg is T {
	return !!arg;
}

const CancelledError = 'Cancelled';

export function isCancelledError(error: any) {
	return error === CancelledError;
}

export class CancellationToken {
	private listeners: Function[] = [];
	private _cancelled: boolean = false;
	get isCancelled(): boolean {
		return this._cancelled;
	}

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

enum LogMessageType {
	DONE,
	INFO,
	WARNING,
	ERROR,
}

const LogPrefix = {
	[LogMessageType.DONE]: chalk.bgGreen.black(' DONE '),
	[LogMessageType.INFO]: chalk.bgBlueBright.black(' INFO '),
	[LogMessageType.WARNING]: chalk.bgYellow.black(' WARNING '),
	[LogMessageType.ERROR]: chalk.bgRed.black(' ERROR '),
};

function _log(type: LogMessageType, msg: any, ...args: any[]): void {
	args = [LogPrefix[type], msg, ...args];

	if (type === LogMessageType.WARNING) {
		process.env['GITHUB_ACTIONS'] ? logToGitHubActions('warning', msg) : console.warn(...args);
	} else if (type === LogMessageType.ERROR) {
		process.env['GITHUB_ACTIONS'] ? logToGitHubActions('error', msg) : console.error(...args);
	} else {
		process.env['GITHUB_ACTIONS'] ? logToGitHubActions('info', msg) : console.log(...args);
	}
}

const EscapeCharacters = new Map([
	['%', '%25'],
	['\r', '%0D'],
	['\n', '%0A'],
]);

const EscapeRegex = new RegExp(`[${[...EscapeCharacters.keys()].join('')}]`, 'g');

function escapeGitHubActionsMessage(message: string): string {
	return message.replace(EscapeRegex, c => EscapeCharacters.get(c) ?? c);
}

function logToGitHubActions(type: string, message: string): void {
	const command = type === 'info' ? message : `::${type}::${escapeGitHubActionsMessage(message)}`;
	process.stdout.write(command + EOL);
}

export interface LogFn {
	(msg: any, ...args: any[]): void;
}

export const log = {
	done: _log.bind(null, LogMessageType.DONE) as LogFn,
	info: _log.bind(null, LogMessageType.INFO) as LogFn,
	warn: _log.bind(null, LogMessageType.WARNING) as LogFn,
	error: _log.bind(null, LogMessageType.ERROR) as LogFn,
};

export function patchOptionsWithManifest(options: any, manifest: Manifest): void {
	if (!manifest.vsce) {
		return;
	}

	for (const key of Object.keys(manifest.vsce)) {
		const optionsKey = key === 'yarn' ? 'useYarn' : key;

		if (options[optionsKey] === undefined) {
			options[optionsKey] = manifest.vsce[key];
		}
	}
}
