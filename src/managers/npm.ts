import * as path from 'path';
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
		if (/^3\.7\.[0123]$/.test(version)) {
			throw new Error(`npm@${version} doesn't work with vsce. Please update npm: npm install -g npm`);
		}
	},
	pmRunCommand(scriptName: string): string {
		return `${this.binaryName} run ${scriptName}`
	},
	async pmProdDependencies(cwd: string, _?: string[]): Promise<string[]> {
		await this.selfCheck()
		const { stdout } = await exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024 })
		return stdout.split(/[\r\n]/).filter(dir => path.isAbsolute(dir))
	},
	async pmFetchLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string> {
		await this.selfCheck(cancellationToken)
		const { stdout } = await exec(`npm show ${name} version`, {}, cancellationToken)
		return stdout.split(/[\r\n]/).filter(line => !!line)[0];
	}
}