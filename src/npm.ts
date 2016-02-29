import * as path from 'path';
import * as cp from 'child_process';
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

function exec(command: string, options: IOptions = {}): Promise<{ stdout: string; stderr: string; }> {
	return new Promise((c, e) => {
		cp.exec(command, assign(options, { encoding: 'utf8' }), (err, stdout: string, stderr: string) => {
			if (err) return e(err);
			c({ stdout, stderr });
		});
	});
}

function checkNPM(): Promise<void> {
	return exec('npm -v').then(({ stdout }) => {
		const version = stdout.trim();

		if (/^3\.7\.[0123]$/.test(version)) {
			return Promise.reject(`npm@${ version } doesn't work with vsce. Please update npm: npm install -g npm`);
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