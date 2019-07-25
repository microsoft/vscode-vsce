import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as parseSemver from 'parse-semver';
import * as _ from 'lodash';
import { CancellationToken, log } from './util';

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
		.then(() => exec('npm list --production --parseable --depth=99999', { cwd, maxBuffer: 5000 * 1024 }))
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
	path: string;
	children: YarnDependency[];
}

function asYarnDependency(prefix: string, name: string, prune: boolean, parentStack:string[]): YarnDependency | null {
	if (prune && /@[\^~]/.test(name)) {
		return null;
	}

	let dependencyPath;
	let newPrefix = prefix;
	// Follow the same resolve logic that is used within npm / yarn
	while(newPrefix !== "/" && !dependencyPath) {
		if (fs.existsSync(path.join(newPrefix, "node_modules", name)))
		{
			dependencyPath = path.join(newPrefix, "node_modules", name)
		}
		else {
			newPrefix = path.join(newPrefix, '..');
		}
	}
	if(!dependencyPath) {
		dependencyPath = path.join(prefix, "node_modules", name)
	}
	const depPackage = require(path.join(dependencyPath, "package.json"));
	const children = [];
	parentStack.push(name);
	if(depPackage.dependencies) {
		const depChildren = Object.keys(depPackage.dependencies);
		depChildren.forEach((childName) => {
			if(parentStack.indexOf(childName) === -1) {
				const dep = asYarnDependency(dependencyPath, childName, prune, parentStack.concat());
				if (dep) {
					children.push(dep);
				}
			}
		});
	}

	return { name, path: dependencyPath, children };
}

function selectYarnDependencies(deps: YarnDependency[], packagedDependencies: string[]): YarnDependency[] {

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
	packagedDependencies.forEach(visit);
	return reached.values;
}

async function getYarnProductionDependencies(cwd: string, packagedDependencies?: string[]): Promise<YarnDependency[]> {
	// `yarn list` command does not behave like `npm ls` and as a result is not reliable to get project dependencies, instead let's just mimic what npm does internally (technically this could be shared with npm implementation to be only one like of code)
	const usingPackagedDependencies = Array.isArray(packagedDependencies);
	const rootPackage = require(path.join(cwd, 'package.json'));
	const trees = Object.keys(rootPackage.dependencies);

	let result = trees
		.map(tree => asYarnDependency(path.join(cwd, 'node_modules'), tree, !usingPackagedDependencies, []))
		.filter(dep => !!dep);

	if (usingPackagedDependencies) {
		result = selectYarnDependencies(result, packagedDependencies);
	}

	return result;
}

async function getYarnDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]> {
	const result: string[] = [cwd];

	if (await new Promise(c => fs.exists(path.join(cwd, 'yarn.lock'), c))) {
		const deps = await getYarnProductionDependencies(cwd, packagedDependencies);
		const flatten = (dep: YarnDependency) => { result.push(dep.path); dep.children.forEach(flatten); };
		deps.forEach(flatten);
	}

	return _.uniq(result);
}

export function getDependencies(cwd: string, useYarn = false, packagedDependencies?: string[]): Promise<string[]> {
	return useYarn ? getYarnDependencies(cwd, packagedDependencies) : getNpmDependencies(cwd);
}

export function getLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string> {
	return checkNPM(cancellationToken)
		.then(() => exec(`npm show ${name} version`, {}, cancellationToken))
		.then(parseStdout);
}
