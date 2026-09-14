import { createHash } from 'crypto';
import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';
import { lock } from 'proper-lockfile';
import { LegacyMigrationError, readLegacyCredential } from './legacyCredentials';
import type { IPublisher, IStore } from './store';
import { log, read } from './util';
import { validatePublisher } from './validation';

export interface ILegacyMigrationOptions {
	readonly serviceName?: string;
	readonly lockPath?: string;
	readonly platform?: NodeJS.Platform;
	readonly interactive?: boolean;
	readonly prompt?: (question: string) => Promise<string>;
	readonly readCredential?: (serviceName: string, publisherName: string) => Promise<IPublisher | undefined>;
}

// Decorate the native store so migration policy and write synchronization stay
// separate from its ordinary credential operations.
export class LegacyCredentialMigration implements IStore {
	static wrap(store: IStore, openStore: () => Promise<IStore>, options: ILegacyMigrationOptions = {}): IStore {
		const platform = options.platform ?? process.platform;
		return platform === 'win32' || platform === 'linux'
			? new LegacyCredentialMigration(store, openStore, options)
			: store;
	}

	private readonly serviceName: string;
	private readonly platform: NodeJS.Platform;
	private readonly lockPath: string;
	private readonly interactive: boolean;
	private readonly prompt: (question: string) => Promise<string>;
	private readonly readCredential: (service: string, name: string) => Promise<IPublisher | undefined>;

	constructor(
		private store: IStore,
		private readonly openStore: () => Promise<IStore>,
		options: ILegacyMigrationOptions = {}
	) {
		this.serviceName = options.serviceName ?? 'vscode-vsce';
		this.platform = options.platform ?? process.platform;
		this.lockPath = options.lockPath ?? path.join(homedir(), '.vsce-keytar-migration',
			createHash('sha256').update(`${this.platform}:${this.serviceName}`).digest('hex'));
		// read() otherwise answers "y" in tests and non-interactive processes.
		this.interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.VSCE_TESTS);
		this.prompt = options.prompt ?? read;
		this.readCredential = options.readCredential
			?? ((service, name) => readLegacyCredential(service, name, { platform: this.platform }));
	}

	get size(): number {
		return this.store.size;
	}

	get(name: string): IPublisher | undefined {
		return this.findPublisher(this.store, name);
	}

	async add(publisher: IPublisher): Promise<void> {
		await this.withLock(() => this.store.add({
			name: this.get(publisher.name)?.name ?? publisher.name,
			pat: publisher.pat,
		}));
	}

	async delete(name: string): Promise<void> {
		await this.withLock(() => this.store.delete(this.get(name)?.name ?? name));
	}

	[Symbol.iterator](): Iterator<IPublisher> {
		return this.store[Symbol.iterator]();
	}

	async tryMigratePublisher(name: string): Promise<IPublisher | undefined> {
		validatePublisher(name);
		const existing = this.get(name);
		if (existing || !this.interactive || (this.platform !== 'win32' && this.platform !== 'linux')) {
			return existing;
		}

		try {
			const legacy = await this.readCredential(this.serviceName, name);
			if (!legacy) {
				return undefined;
			}
			if (!this.sameAccount(legacy.name, name) || !legacy.pat) {
				throw new LegacyMigrationError('The legacy credential reader returned an invalid credential.');
			}
			const answer = await this.prompt(
				`A saved PAT for publisher '${name}' was found in the previous credential store. Copy it to the new store? [y/N] `
			);
			if (!/^y$/i.test(answer.trim())) {
				return undefined;
			}

			// Do not hold a cross-process lock while waiting for the user's answer.
			return await this.withLock(() => this.copyAndVerify({ name, pat: legacy.pat }));
		} catch (error) {
			if (!(error instanceof LegacyMigrationError)) {
				throw error;
			}
			log.warn(`${error.message} The previous credential was not changed. `
				+ (this.platform === 'linux' ? 'Legacy lookup requires secret-tool (libsecret-tools on Debian/Ubuntu) and an accessible desktop keyring. ' : '')
				+ 'Enter a PAT to continue, or retry after resolving the credential-store problem.');
			return undefined;
		}
	}

	private async copyAndVerify(publisher: IPublisher): Promise<IPublisher> {
		let verified: IStore;
		try {
			const destination = await this.openStore();
			const current = this.findPublisher(destination, publisher.name);
			if (current) {
				this.store = destination;
				return current;
			}
			await destination.add(publisher);
			verified = await this.openStore();
			const saved = this.findPublisher(verified, publisher.name);
			if (saved?.pat !== publisher.pat) {
				throw new LegacyMigrationError('The copied PAT could not be verified.');
			}
		} catch (error) {
			if (!(error instanceof Error)) {
				throw error;
			}
			// Native failures must not include secret values in CLI diagnostics.
			throw new LegacyMigrationError(`Could not copy and verify the previous PAT for publisher '${publisher.name}'.`);
		}
		this.store = verified;
		log.info(`Copied the saved PAT for publisher '${publisher.name}'. The previous credential was not changed.`);
		return publisher;
	}

	private sameAccount(a: string, b: string): boolean {
		return this.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
	}

	private findPublisher(store: IStore, name: string): IPublisher | undefined {
		return [...store].find(publisher => this.sameAccount(publisher.name, name));
	}

	private async withLock<T>(operation: () => Promise<T>): Promise<T> {
		let release: () => Promise<void>;
		try {
			await fs.promises.mkdir(this.lockPath, { recursive: true, mode: 0o700 });
			release = await lock(this.lockPath, {
				stale: 120_000,
				update: 5_000,
				retries: { retries: 120, factor: 1, minTimeout: 250, maxTimeout: 250 },
			});
		} catch (error) {
			if (error instanceof Error && 'code' in error) {
				throw new LegacyMigrationError('Could not lock the credential store. Another vsce command may still be using it.');
			}
			throw error;
		}
		try {
			return await operation();
		} finally {
			await release();
		}
	}
}
