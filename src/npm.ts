import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import parseSemver from 'parse-semver';
import { CancellationToken, log, nonnull } from './util';

const exists = (file: string) =>
	fs.promises.stat(file).then(
		_ => true,
		_ => false
	);

interface IOptions {
	cwd?: string;
	stdio?: any;
	customFds?: any;
	env?: any;
	timeout?: number;
	maxBuffer?: number;
	killSignal?: string;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'none';

function parseStdout({ stdout }: { stdout: string }): string {
	return stdout.split(/[\r\n]/).filter(line => !!line)[0];
}

function exec(
	command: string,
	options: IOptions = {},
	cancellationToken?: CancellationToken
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((c, e) => {
		let disposeCancellationListener: Function | null = null;

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
			disposeCancellationListener = cancellationToken.subscribe((err: any) => {
				child.kill();
				e(err);
			});
		}
	});
}

async function checkNPM(cancellationToken?: CancellationToken): Promise<void> {
	const { stdout } = await exec('npm -v', {}, cancellationToken);
	const version = stdout.trim();

	if (/^3\.7\.[0123]$/.test(version)) {
		throw new Error(`npm@${version} doesn't work with vsce. Please update npm: npm install -g npm`);
	}
}

function getNpmDependencies(cwd: string): Promise<string[]> {
	return checkNPM()
		.then(() =>
			exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024 })
		)
		.then(({ stdout }) => stdout.split(/[\r\n]/).filter(dir => path.isAbsolute(dir)));
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

function asYarnDependency(prefix: string, tree: YarnTreeNode, prune: boolean): YarnDependency | null {
	if (prune && /@[\^~]/.test(tree.name)) {
		return null;
	}

	let name: string;

	try {
		const parseResult = parseSemver(tree.name);
		name = parseResult.name;
	} catch (err) {
		name = tree.name.replace(/^([^@+])@.*$/, '$1');
	}

	const dependencyPath = path.join(prefix, name);
	const children: YarnDependency[] = [];

	for (const child of tree.children || []) {
		const dep = asYarnDependency(path.join(prefix, name, 'node_modules'), child, prune);

		if (dep) {
			children.push(dep);
		}
	}

	return { name, path: dependencyPath, children };
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

async function getYarnProductionDependencies(cwd: string, packagedDependencies?: string[]): Promise<YarnDependency[]> {
	const raw = await new Promise<string>((c, e) =>
		cp.exec(
			'yarn list --prod --json',
			{ cwd, encoding: 'utf8', env: { DISABLE_V8_COMPILE_CACHE: "1", ...process.env }, maxBuffer: 5000 * 1024 },
			(err, stdout) => (err ? e(err) : c(stdout))
		)
	);
	const match = /^{"type":"tree".*$/m.exec(raw);

	if (!match || match.length !== 1) {
		throw new Error('Could not parse result of `yarn list --json`');
	}

	const usingPackagedDependencies = Array.isArray(packagedDependencies);
	const trees = JSON.parse(match[0]).data.trees as YarnTreeNode[];

	let result = trees
		.map(tree => asYarnDependency(path.join(cwd, 'node_modules'), tree, !usingPackagedDependencies))
		.filter(nonnull);

	if (usingPackagedDependencies) {
		result = selectYarnDependencies(result, packagedDependencies!);
	}

	return result;
}

async function getYarnDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]> {
	const result = new Set([cwd]);

	const deps = await getYarnProductionDependencies(cwd, packagedDependencies);
	const flatten = (dep: YarnDependency) => {
		result.add(dep.path);
		dep.children.forEach(flatten);
	};
	deps.forEach(flatten);

	return [...result];
}

export interface PnpmDependency {
	name?: string;
	from?: string;
	path: string;
	dependencies?: Record<string, PnpmDependency>;
}

export interface DependencyPath {
	localPath: string;
	path: string;
}

export function getPnpmDependencyPaths(roots: PnpmDependency[], packagedDependencies?: string[]): DependencyPath[] {
	if (roots.length !== 1) {
		throw new Error(`Expected pnpm to return one project, received ${roots.length}.`);
	}

	const root = roots[0];
	const result: DependencyPath[] = [{ localPath: root.path, path: '' }];
	const seen = new Set<string>();
	const visit = (name: string, dependency: PnpmDependency, destination: string): void => {
		const dependencyPath = path.posix.join(destination, 'node_modules', name);
		const key = `${dependency.path}\0${dependencyPath}`;
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		result.push({ localPath: dependency.path, path: dependencyPath });
		for (const [childName, child] of Object.entries(dependency.dependencies ?? {})) {
			visit(childName, child, dependencyPath);
		}
	};

	if (packagedDependencies) {
		for (const name of packagedDependencies) {
			const dependency = root.dependencies?.[name];
			if (!dependency) {
				throw new Error(`Could not find dependency: ${name}`);
			}
			visit(name, dependency, '');
		}
	} else {
		for (const [name, dependency] of Object.entries(root.dependencies ?? {})) {
			visit(name, dependency, '');
		}
	}

	return [...result];
}

export async function getPnpmDependencies(cwd: string, packagedDependencies?: string[]): Promise<DependencyPath[]> {
	const args = ['list', '--prod', '--json', '--depth', 'Infinity', '--filter', '.'];
	let result = cp.spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
		cwd,
		encoding: 'utf8',
		maxBuffer: 5000 * 1024,
	});
	if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
		result = cp.spawnSync(process.platform === 'win32' ? 'corepack.cmd' : 'corepack', ['pnpm', ...args], {
			cwd,
			encoding: 'utf8',
			maxBuffer: 5000 * 1024,
		});
	}
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`pnpm list failed with exit code ${result.status}: ${result.stderr}`);
	}
	return getPnpmDependencyPaths(JSON.parse(result.stdout) as PnpmDependency[], packagedDependencies);
}

export async function detectYarn(cwd: string): Promise<boolean> {
	for (const name of ['yarn.lock', '.yarnrc', '.yarnrc.yaml', '.pnp.cjs', '.yarn']) {
		if (await exists(path.join(cwd, name))) {
			if (!process.env['VSCE_TESTS']) {
				log.info(
					`Detected presence of ${name}. Using 'yarn' instead of 'npm' (to override this pass '--no-yarn' on the command line).`
				);
			}
			return true;
		}
	}
	return false;
}

export async function detectPnpm(cwd: string): Promise<boolean> {
	return await exists(path.join(cwd, 'pnpm-lock.yaml'));
}

export async function getDependencies(
	cwd: string,
	dependencies: Exclude<PackageManager, 'pnpm'> | undefined,
	packagedDependencies?: string[]
): Promise<string[]> {
	if (dependencies === 'none') {
		return [cwd];
	} else if (dependencies === 'yarn' || (dependencies === undefined && (await detectYarn(cwd)))) {
		return await getYarnDependencies(cwd, packagedDependencies);
	} else {
		return await getNpmDependencies(cwd);
	}
}

export function getLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string> {
	return checkNPM(cancellationToken)
		.then(() => exec(`npm show ${name} version`, {}, cancellationToken))
		.then(parseStdout);
}
