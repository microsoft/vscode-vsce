import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as parseSemver from 'parse-semver';
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

	let name: string, version: string;

	try {
		const parseResult = parseSemver(tree.name);
		name = parseResult.name;
		version = parseResult.version;
	} catch (err) {
		console.error('Failed to parse dependency:', tree.name);
		return null;
	}

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

function selectYarnDependencies(deps: YarnDependency[], entries: string[]): YarnDependency[] {

	const index = new class {
		private data: { [name: string]: YarnDependency } = Object.create(null);
		constructor() {
			for (const dep of deps) {
				if (this.data[dep.name]) {
					throw Error(`Dependency seen more than once: ${dep.name}`);
				}
				this.data[dep.name] = dep;
			}
		}
		find(name: string): YarnDependency {
			let result = this.data[name];
			if (!result) {
				throw new Error(`Could not find dependency: ${name}`);
			}
			return result;
		}
	};

	const reached = new class {
		values: YarnDependency[] = [];
		add(dep: YarnDependency): boolean {
			if (this.values.indexOf(dep) < 0) {
				this.values.push(dep);
				return true;
			}
			return false;
		}
	};

	const visit = (name: string) => {
		let dep = index.find(name);
		if (!reached.add(dep)) {
			// already seen -> done
			return;
		}
		for (const child of dep.children) {
			visit(child.name);
		}
	};
	entries.forEach(visit);
	return reached.values;
}

async function getYarnProductionDependencies(cwd: string): Promise<YarnDependency[]> {
	const raw = await new Promise<string>((c, e) => cp.exec('yarn list --prod --json', { cwd, encoding: 'utf8', env: { ...process.env } }, (err, stdout) => err ? e(err) : c(stdout)));
	const match = /^{"type":"tree".*$/m.exec(raw);

	if (!match || match.length !== 1) {
		throw new Error('Could not parse result of `yarn list --json`');
	}

	const trees = JSON.parse(match[0]).data.trees as YarnTreeNode[];

	let result = trees
		.map(tree => asYarnDependency(path.join(cwd, 'node_modules'), tree))
		.filter(dep => !!dep);

	try {
		let pkg = require(path.join(cwd, 'package.json'));
		let entries = pkg['vscode:packagedDependencies'];
		if (Array.isArray(entries) && entries.length > 0) {
			result = selectYarnDependencies(result, entries);
		}
	} catch (err) {
		console.log(err);
		// ignore
	}

	return result;
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
