import * as path from 'path';
import * as semver from 'semver';
import { glob } from 'glob';
import { exec } from "./exec";
import type { IPackageManager } from "./manager";
import type { CancellationToken } from "../util";

export const pmNPM: IPackageManager = {
	binaryName: 'npm',

	async selfVersion(cancellationToken?: CancellationToken): Promise<string> {
		const { stdout } = await exec('npm -v', {}, cancellationToken);
		return stdout.trim();
	},
	async selfCheck(cancellationToken?: CancellationToken): Promise<void> {
		const version = await this.selfVersion(cancellationToken);
		if (semver.intersects(version, '< 6')) {
			throw new Error(`npm@${version} doesn't work with vsce. Please update npm: ${this.commandInstall('npm', true)}`);
		}
	},

	commandRun(scriptName: string): string {
		return `${this.binaryName} run ${scriptName}`
	},
	commandInstall(pkg: string, global: boolean): string {
		let flag = (global ? '-g' : '')
		flag &&= flag + " "
		return `${this.binaryName} install ${flag}${pkg}`
	},

	async pkgRequestLatest(name: string, cancellationToken?: CancellationToken): Promise<string> {
		await this.selfCheck(cancellationToken)
		const { stdout } = await exec(`npm show ${name} version`, {}, cancellationToken)
		return stdout.split(/[\r\n]/).filter(line => !!line)[0];
	},
	async pkgProdDependencies(cwd: string, _?: string[]): Promise<string[]> {
		await this.selfCheck()
		const { stdout } = await exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024 })
		return stdout.split(/[\r\n]/).filter(dir => path.isAbsolute(dir))
	},
	async pkgProdDependenciesFiles(cwd: string, deps: string[], followSymlinks?: boolean): Promise<string[]> {
		const promises = deps.map(dep =>
			glob('**', { cwd: dep, nodir: true, follow: followSymlinks, dot: true, ignore: 'node_modules/**' }).then(files =>
				files.map(f => path.relative(cwd, path.join(dep, f))).map(f => f.replace(/\\/g, '/'))
			)
		);

		return Promise.all(promises).then(arr => arr.flat());
	},
}