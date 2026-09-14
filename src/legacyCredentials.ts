import { execFile } from 'child_process';
import * as path from 'path';
import type { IPublisher } from './store';
import { validatePublisher } from './validation';
import { windowsKeytarReadScript } from './windowsKeytar';

export class LegacyMigrationError extends Error { }

export interface ICredentialCommandResult {
	readonly stdout: string;
	readonly stderr: string;
	readonly exitCode: number;
}

export type CredentialCommandRunner = (
	file: string,
	args: string[],
	env?: NodeJS.ProcessEnv
) => Promise<ICredentialCommandResult>;

const runCredentialCommand: CredentialCommandRunner = (file, args, env) => new Promise((resolve, reject) => {
	execFile(file, args, {
		encoding: 'utf8',
		env,
		windowsHide: true,
		timeout: 30_000,
		maxBuffer: 1024 * 1024,
	}, (error, stdout, stderr) => {
		if (error && (typeof error.code !== 'number' || error.killed)) {
			// Child-process errors can contain stdout/stderr, including PATs.
			const reason = error.code === 'ENOENT' ? 'is not installed'
				: error.killed ? 'timed out or was terminated'
					: 'failed to read the previous credential';
			reject(new LegacyMigrationError(`${path.basename(file)} ${reason}.`));
		} else {
			resolve({ stdout, stderr, exitCode: typeof error?.code === 'number' ? error.code : 0 });
		}
	});
});

function parseWindowsCredential(stdout: string, name: string): IPublisher | undefined {
	let value: unknown;
	try {
		value = JSON.parse(stdout);
	} catch (error) {
		if (!(error instanceof SyntaxError)) {
			throw error;
		}
		throw new LegacyMigrationError('The Windows credential reader returned an invalid response.');
	}
	if (value === null) {
		return undefined;
	}
	if (!value || typeof value !== 'object'
		|| !('name' in value) || typeof value.name !== 'string' || value.name.toLowerCase() !== name.toLowerCase()
		|| !('pat' in value) || typeof value.pat !== 'string' || !value.pat) {
		throw new LegacyMigrationError('The Windows credential reader returned an invalid credential.');
	}
	return { name, pat: value.pat };
}

export async function readLegacyCredential(
	serviceName: string,
	publisherName: string,
	{ platform = process.platform, run = runCredentialCommand }: {
		platform?: NodeJS.Platform;
		run?: CredentialCommandRunner;
	} = {}
): Promise<IPublisher | undefined> {
	validatePublisher(publisherName);
	if (platform === 'win32') {
		const powershell = path.win32.join(
			process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
		);
		const { stdout, exitCode } = await run(powershell, [
			'-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsKeytarReadScript,
		], { ...process.env, VSCE_KEYTAR_SERVICE: serviceName, VSCE_KEYTAR_ACCOUNT: publisherName });
		if (exitCode !== 0) {
			throw new LegacyMigrationError('Windows PowerShell could not read the previous credential.');
		}
		return parseWindowsCredential(stdout, publisherName);
	}
	if (platform !== 'linux') {
		return undefined;
	}

	const { stdout, stderr, exitCode } = await run('secret-tool', [
		'lookup', 'service', serviceName, 'account', publisherName,
		'xdg:schema', 'org.freedesktop.Secret.Generic',
	]);
	// secret-tool exits 1 without output when no item matches; other failures
	// must not masquerade as a missing credential or expose raw diagnostics.
	if (exitCode === 1 && !stdout && !stderr) {
		return undefined;
	}
	if (exitCode !== 0 || !stdout) {
		throw new LegacyMigrationError('secret-tool could not read the previous credential.');
	}
	return { name: publisherName, pat: stdout };
}
