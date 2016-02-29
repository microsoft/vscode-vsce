import * as path from 'path';
import * as cp from 'child_process';

const listCmd = 'npm list --production --parseable';

export function getDependencies(cwd: string): Promise<string[]> {
	return isBadNpmVersion()
		.then((isBadVersion) => {
			if(isBadVersion) {
				console.warn('You are using a npm version, that does not work well with vsce! Consider to update with "npm install -g npm".')
			}
		}).then(() => {
			return new Promise<string[]>((c, e) => {
				cp.exec(listCmd, { cwd }, (err, stdout, stderr) => {
						if (err) return e(err);

						c(stdout.toString('utf8')
							.split(/[\r\n]/)
							.filter(dir => path.isAbsolute(dir)));
					}
				);
			});
		});
}

const versionCmd = 'npm -v';

const badNpmVersions = [
	/3.7.[0123]/
];

export function isBadNpmVersion(): Promise<boolean> {
	return new Promise<boolean>((c, e) => {
		cp.exec(versionCmd, (err, stdout, stderr) => {
			if (err) return e(err);
			
			let version = stdout.toString('utf8').trim();
			c(badNpmVersions.some((regex) => regex.test(version)));
		});
	});
}