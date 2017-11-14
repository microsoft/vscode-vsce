import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as semver from 'semver';
import * as _ from 'lodash';
import { CancellationToken } from './util';

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

		const child = cp.exec(command, { ...options, encoding: 'utf8' } as any, (err, stdout: string, stderr: string) => {
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

function getNpmDependencies(cwd: string): Promise<string[]> {
	return checkNPM()
		.then(() => exec('npm list --production --parseable --depth=99999', { cwd }))
		.then(({ stdout }) => stdout
			.split(/[\r\n]/)
			.filter(dir => path.isAbsolute(dir)));
}

interface YarnTreeNode {
	name: string;
	children: YarnTreeNode[];
}

export interface YarnDependency {
	name: string;
	version: string;
	path: string;
	children: YarnDependency[];
}

function asYarnDependency(prefix: string, tree: YarnTreeNode): YarnDependency | null {
	if (/@[\^~]/.test(tree.name)) {
		return null;
	}

	const version = tree.name.replace(/^[^@]+@/, '');

	if (!semver.valid(version)) {
		return null;
	}

	const name = tree.name.replace(/@[^@]+$/, '');
	const dependencyPath = path.join(prefix, name);
	const children: YarnDependency[] = [];

	for (const child of (tree.children || [])) {
		const dep = asYarnDependency(path.join(prefix, name, 'node_modules'), child);

		if (dep) {
			children.push(dep);
		}
	}

	return { name, version, path: dependencyPath, children };
}

async function getYarnProductionDependencies(cwd: string): Promise<YarnDependency[]> {
	const raw = await new Promise<string>((c, e) => cp.exec('yarn list --json', { cwd, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } }, (err, stdout) => err ? e(err) : c(stdout)));
	const match = /^{"type":"tree".*$/m.exec(raw);

	if (!match || match.length !== 1) {
		throw new Error('Could not parse result of `yarn list --json`');
	}

	const trees = JSON.parse(match[0]).data.trees as YarnTreeNode[];

	return trees
		.map(tree => asYarnDependency(path.join(cwd, 'node_modules'), tree))
		.filter(dep => !!dep);
}

async function getYarnDependencies(cwd: string): Promise<string[]> {
	const result: string[] = [cwd];

	if (await new Promise(c => fs.exists(path.join(cwd, 'yarn.lock'), c))) {
		const deps = await getYarnProductionDependencies(cwd);
		const flatten = (dep: YarnDependency) => { result.push(dep.path); dep.children.forEach(flatten); };
		deps.forEach(flatten);
	}

	return _.uniq(result);
}

export function getDependencies(cwd: string, useYarn = false): Promise<string[]> {
	return useYarn ? getYarnDependencies(cwd) : getNpmDependencies(cwd);
}

export function getLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string> {
	return checkNPM(cancellationToken)
		.then(() => exec(`npm show ${name} version`, {}, cancellationToken))
		.then(parseStdout);
}