import * as path from 'path';
import * as cp from 'child_process';
import { CancellationToken } from './util';
import { assign } from 'lodash';

interface IOptions {
	cwd?: string;
	stdio?: any;
	customFds?: any;
	env?: any;
	timeout?: number;
	maxBuffer?: number;
	killSignal?: string;
}

function parseStdout({ stdout }: { stdout: string }): string {
	return stdout.split(/[\r\n]/).filter(line => !!line)[0];
}

function exec(command: string, options: IOptions = {}, cancellationToken?: CancellationToken): Promise<{ stdout: string; stderr: string; }> {
	return new Promise((c, e) => {
		let disposeCancellationListener: Function = null;

		const child = cp.exec(command, assign(options, { encoding: 'utf8' }), (err, stdout: string, stderr: string) => {
			if (disposeCancellationListener) {
				disposeCancellationListener();
				disposeCancellationListener = null;
			}

			if (err) { return e(err); }
			c({ stdout, stderr });
		});

		if (cancellationToken) {
			disposeCancellationListener = cancellationToken.subscribe(err => {
				child.kill();
				e(err);
			});
		}
	});
}

function checkNPM(cancellationToken?: CancellationToken): Promise<void> {
	return exec('npm -v', {}, cancellationToken).then(({ stdout }) => {
		const version = stdout.trim();

		if (/^3\.7\.[0123]$/.test(version)) {
			return Promise.reject(`npm@${version} doesn't work with vsce. Please update npm: npm install -g npm`);
		}
	});
}

export function getDependencies(cwd: string): Promise<string[]> {
	return checkNPM()
		.then(() => exec('npm list --production --parseable --depth=99999', { cwd }))
		.then(({ stdout }) => stdout
			.split(/[\r\n]/)
			.filter(dir => path.isAbsolute(dir)));
}

export function getLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string> {
	return checkNPM(cancellationToken)
		.then(() => exec(`npm show ${name} version`, {}, cancellationToken))
		.then(parseStdout);
}