import { promisify } from 'util';
import * as fs from 'fs';
import _read from 'read';
import { WebApi, getBasicHandler } from 'azure-devops-node-api/WebApi';
import { IGalleryApi, GalleryApi } from 'azure-devops-node-api/GalleryApi';
import chalk from 'chalk';
import { PublicGalleryAPI } from './publicgalleryapi';
import { ISecurityRolesApi } from 'azure-devops-node-api/SecurityRolesApi';
import { ManifestPackage } from './manifest';
import { EOL } from 'os';

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

export function patchOptionsWithManifest(options: any, manifest: ManifestPackage): void {
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

export function bytesToString(bytes: number): string {
	let size = 0;
	let unit = '';

	if (bytes > 1048576) {
		size = Math.round(bytes / 10485.76) / 100;
		unit = 'MB';
	} else {
		size = Math.round(bytes / 10.24) / 100;
		unit = 'KB';
	}
	return `${size} ${unit}`;
}

export function filePathToVsixPath(originalFilePath: string): string {
	return `extension/${originalFilePath}`;
}

export function vsixPathToFilePath(extensionFilePath: string): string {
	return extensionFilePath.startsWith('extension/') ? extensionFilePath.substring('extension/'.length) : extensionFilePath;
}

const FOLDER_SIZE_KEY = "/__FOlDER_SIZE__\\";
const FOLDER_FILES_TOTAL_KEY = "/__FOLDER_CHILDREN__\\";
const FILE_SIZE_WARNING_THRESHOLD = 0.85;
const FILE_SIZE_LARGE_THRESHOLD = 0.2;

export async function generateFileStructureTree(rootFolder: string, filePaths: { origin: string, tree: string }[], printLinesLimit: number = Number.MAX_VALUE): Promise<string[]> {
	const folderTree: any = {};
	const depthCounts: number[] = [];

	// Build a tree structure from the file paths
	// Store the file size in the leaf node and the folder size in the folder node
	// Store the number of children in the folder node
	for (const filePath of filePaths) {
		const parts = filePath.tree.split('/');
		let currentLevel = folderTree;

		parts.forEach((part, depth) => {
			const isFile = depth === parts.length - 1;

			// Create the node if it doesn't exist
			if (!currentLevel[part]) {
				if (isFile) {
					// The file size is stored in the leaf node, 
					currentLevel[part] = 0;
				} else {
					// The folder size is stored in the folder node
					currentLevel[part] = {};
					currentLevel[part][FOLDER_SIZE_KEY] = 0;
					currentLevel[part][FOLDER_FILES_TOTAL_KEY] = 0;
				}

				// Count the number of items at each depth
				if (depthCounts.length <= depth) {
					depthCounts.push(0);
				}
				depthCounts[depth]++;
			}

			currentLevel = currentLevel[part];

			// Count the total number of children in the nested folders
			if (!isFile) {
				currentLevel[FOLDER_FILES_TOTAL_KEY]++;
			}
		});
	};

	// Get max depth depending on the maximum number of lines allowed to print
	let currentDepth = 0;
	let countUpToCurrentDepth = depthCounts[0] + 1 /* root folder */;
	for (let i = 1; i < depthCounts.length; i++) {
		if (countUpToCurrentDepth + depthCounts[i] > printLinesLimit) {
			break;
		}
		currentDepth++;
		countUpToCurrentDepth += depthCounts[i];
	}
	const maxDepth = currentDepth;

	// Get all file sizes
	const fileSizes: [number, string][] = await Promise.all(filePaths.map(async (filePath) => {
		try {
			const stats = await fs.promises.stat(filePath.origin);
			return [stats.size, filePath.tree];
		} catch (error) {
			return [0, filePath.origin];
		}
	}));

	// Store all file sizes in the tree
	let totalFileSizes = 0;
	fileSizes.forEach(([size, filePath]) => {
		totalFileSizes += size;

		const parts = filePath.split('/');
		let currentLevel = folderTree;
		parts.forEach(part => {
			if (typeof currentLevel[part] === 'number') {
				currentLevel[part] = size;
			} else if (currentLevel[part]) {
				currentLevel[part][FOLDER_SIZE_KEY] += size;
			}
			currentLevel = currentLevel[part];
		});
	});

	let output: string[] = [];
	output.push(chalk.bold(rootFolder));
	output.push(...createTreeOutput(folderTree, maxDepth, totalFileSizes));

	for (const [size, filePath] of fileSizes) {
		if (size > FILE_SIZE_WARNING_THRESHOLD * totalFileSizes) {
			output.push(`\nThe file ${filePath} is ${chalk.red('large')} (${bytesToString(size)})`);
			break;
		}
	}

	return output;
}

function createTreeOutput(fileSystem: any, maxDepth: number, totalFileSizes: number): string[] {

	const getColorFromSize = (size: number) => {
		if (size > FILE_SIZE_WARNING_THRESHOLD * totalFileSizes) {
			return chalk.red;
		} else if (size > FILE_SIZE_LARGE_THRESHOLD * totalFileSizes) {
			return chalk.yellow;
		} else {
			return chalk.grey;
		}
	};

	const createFileOutput = (prefix: string, fileName: string, fileSize: number) => {
		let fileSizeColored = '';
		if (fileSize > 0) {
			const fileSizeString = `[${bytesToString(fileSize)}]`;
			fileSizeColored = getColorFromSize(fileSize)(fileSizeString);
		}
		return `${prefix}${fileName} ${fileSizeColored}`;
	}

	const createFolderOutput = (prefix: string, filesCount: number, folderSize: number, folderName: string, depth: number) => {
		if (depth < maxDepth) {
			// Max depth is not reached, print only the folder
			// as children will be printed
			return prefix + chalk.bold(`${folderName}/`);
		}

		// Max depth is reached, print the folder name and additional metadata
		// as children will not be printed
		const folderSizeString = bytesToString(folderSize);
		const folder = chalk.bold(`${folderName}/`);
		const numFilesString = chalk.green(`(${filesCount} ${filesCount === 1 ? 'file' : 'files'})`);
		const folderSizeColored = getColorFromSize(folderSize)(`[${folderSizeString}]`);
		return `${prefix}${folder} ${numFilesString} ${folderSizeColored}`;
	}

	const createTreeLayerOutput = (tree: any, depth: number, prefix: string, path: string) => {
		// Print all files before folders
		const sortedFolderKeys = Object.keys(tree).filter(key => typeof tree[key] !== 'number').sort();
		const sortedFileKeys = Object.keys(tree).filter(key => typeof tree[key] === 'number').sort();
		const sortedKeys = [...sortedFileKeys, ...sortedFolderKeys].filter(key => key !== FOLDER_SIZE_KEY && key !== FOLDER_FILES_TOTAL_KEY);

		const output: string[] = [];
		for (let i = 0; i < sortedKeys.length; i++) {
			const key = sortedKeys[i];
			const isLast = i === sortedKeys.length - 1;
			const localPrefix = prefix + (isLast ? '└─ ' : '├─ ');
			const childPrefix = prefix + (isLast ? '   ' : '│  ');

			if (typeof tree[key] === 'number') {
				// It's a file
				output.push(createFileOutput(localPrefix, key, tree[key]));
			} else {
				// It's a folder
				output.push(createFolderOutput(localPrefix, tree[key][FOLDER_FILES_TOTAL_KEY], tree[key][FOLDER_SIZE_KEY], key, depth));
				if (depth < maxDepth) {
					output.push(...createTreeLayerOutput(tree[key], depth + 1, childPrefix, path + key + '/'));
				}
			}
		}
		return output;
	};

	return createTreeLayerOutput(fileSystem, 0, '', '');
}
