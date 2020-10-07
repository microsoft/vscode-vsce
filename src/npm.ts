import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as _ from 'lodash';
import * as findWorkspaceRoot from 'find-yarn-workspace-root';
import { CancellationToken } from './util';
import { Manifest } from './manifest';
import { readNodeManifest } from './package';

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

function exec(
	command: string,
	options: IOptions = {},
	cancellationToken?: CancellationToken
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((c, e) => {
		let disposeCancellationListener: Function = null;

		const child = cp.exec(command, { ...options, encoding: 'utf8' } as any, (err, stdout: string, stderr: string) => {
			if (disposeCancellationListener) {
				disposeCancellationListener();
				disposeCancellationListener = null;
			}

			if (err) {
				return e(err);
			}
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

function getNpmDependencies(cwd: string): Promise<SourceAndDestination[]> {
	return checkNPM()
		.then(() =>
			exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024 })
		)
		.then(({ stdout }) => stdout.split(/[\r\n]/).filter(dir => path.isAbsolute(dir))
			.map(dir => {
				return {
					src: dir,
					dest: path.relative(cwd, dir)
				}
			}));
}

export interface YarnDependency {
	name: string;
	path: SourceAndDestination;
	children: YarnDependency[];
}

export interface SourceAndDestination {
	src: string;
	dest: string;
}

async function asYarnDependencies(root: string, rootDependencies: string[]): Promise<YarnDependency[]> {
	const resolve = async (prefix: string, dependencies: string[], collected: Map<string, YarnDependency> = new Map()): Promise<YarnDependency[]> => await Promise.all(dependencies
		.map(async (name: string) => {
			let newPrefix = prefix, depPath = null, depManifest = null;
			while (!depManifest && root.length <= newPrefix.length) {
				depPath = path.join(newPrefix, 'node_modules', name);
				try {
					depManifest = await readNodeManifest(depPath);
				}
				catch (err) {
          newPrefix = path.join(newPrefix, '..');
					if (newPrefix.length < root.length) {
						throw err;
					}
				}
			}
			const result = {
				name,
				path: {
					src: depPath,
					dest: path.relative(root, depPath),
				},
				children: [],
			};
			const shouldResolveChildren = !collected.has(depPath);
			collected.set(depPath, result);
			if (shouldResolveChildren) {
				result.children = await resolve(depPath, Object.keys(depManifest.dependencies || {}), collected);
			}
			return result;
		}));
	return resolve(root, rootDependencies);
}

function selectYarnDependencies(deps: YarnDependency[], packagedDependencies: string[]): YarnDependency[] {
	const index = new (class {
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
	})();

	const reached = new (class {
		values: YarnDependency[] = [];
		add(dep: YarnDependency): boolean {
			if (this.values.indexOf(dep) < 0) {
				this.values.push(dep);
				return true;
			}
			return false;
		}
	})();

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

async function getYarnProductionDependencies(root: string, manifest: Manifest, packagedDependencies?: string[]): Promise<YarnDependency[]> {
	const usingPackagedDependencies = Array.isArray(packagedDependencies);

	let result = await asYarnDependencies(root, Object.keys(manifest.dependencies || {}));

	if (usingPackagedDependencies) {
		result = selectYarnDependencies(result, packagedDependencies);
	}

	return result;
}

async function getYarnDependencies(cwd: string, manifest: Manifest, packagedDependencies?: string[]): Promise<SourceAndDestination[]> {
	const root = findWorkspaceRoot(cwd) || cwd;
	const result: SourceAndDestination[] = [{
		src: cwd,
		dest: ''
	}];

	if (await new Promise(c => fs.exists(path.join(root, 'yarn.lock'), c))) {
		const deps = await getYarnProductionDependencies(root, manifest, packagedDependencies);
		const flatten = (dep: YarnDependency) => {
			result.push(dep.path);
			dep.children.forEach(flatten);
		};
		deps.forEach(flatten);
	}

	return _.uniqBy(result, 'src');
}

export function getDependencies(cwd: string, manifest: Manifest, useYarn = false, packagedDependencies?: string[]): Promise<SourceAndDestination[]> {
	return useYarn ? getYarnDependencies(cwd, manifest, packagedDependencies) : getNpmDependencies(cwd);
}

export function getLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string> {
	return checkNPM(cancellationToken)
		.then(() => exec(`npm show ${name} version`, {}, cancellationToken))
		.then(parseStdout);
}
