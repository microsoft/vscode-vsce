import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import parseSemver from 'parse-semver';
import { CancellationToken, log, nonnull } from './util';
import type { ManifestPackage } from './manifest';

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

/**
 * A list of supported package managers that can be used for unbundled extensions.
 */
export const supportedRaw = ['npm', 'yarn1'] as ManagerName[]

const YARN = [
	{ name: 'yarn', files: ['.yarnrc.yaml', '.pnp.cjs', '.yarn/releases'] },
	{ name: 'yarn1', files: ['.yarnrc', 'yarn.lock'] },
] as const

const MANAGERS = [
	...YARN,
	{ name: 'pnpm', files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.pnpmfile.cjs'] },
	{ name: 'bun',  files: ['bun.lock', 'bunfig.toml', 'bun.lockb'] },
	{ name: 'vlt',  files: ['vlt-lock.json', '.vltrc'] },
	{ name: 'deno', files: ['deno.lock', 'deno.json', 'deno.jsonc'] },
	{ name: 'npm', files: ['package.json', 'package-lock.json'] },
] as const;

export type ManagerName = (typeof MANAGERS)[number]['name'];

export async function detectPackageManager(cwd: string, manifest: ManifestPackage, useYarn: boolean | undefined, care?: ManagerName[]): Promise<string | null> {
	const m = useYarn ? YARN : care ? MANAGERS.filter(({name}) => care.includes(name)) : MANAGERS;
	for (const { name } of m) {
		if (
			manifest?.devEngines?.packageManager?.name === name ||
			manifest?.packageManager?.startsWith(`${name}@`)
		) {
			if (process.env['VSCE_DEBUG']) console.log('Package manager:', name);
			return name;
		}
	}

	for (const mgr of m) {
		for (const filename of mgr.files) {
			if (!await exists(path.join(cwd, filename))) {
				continue;
			}
			if (!process.env['VSCE_TESTS']) {
				const suffix = mgr.name === 'yarn'
					? " instead of 'npm' (to override this pass '--no-yarn' on the command line)."
					: ' logic.';
				log.info(`Detected presence of ${filename}. Using '${mgr.name}'${suffix}`);
			}
			if (process.env['VSCE_DEBUG']) console.log('Package manager:', mgr.name);
			return mgr.name;
		}
	}

	if (process.env['VSCE_DEBUG']) console.log('Package manager: null');
	return null;
}

export async function getPrepublishCommand(manifest: ManifestPackage, pm: string | null): Promise<string> {
	const envv = process.env['VSCE_RUN_PREPUBLISH']
	if (envv === "" || envv === "0" || manifest?.vsce?.runPrepublish === false) return "";
	const customCommand = envv || manifest?.vsce?.runPrepublish;
	if (customCommand) {
		return customCommand;
	}

	if (pm === null) return 'npm run vscode:prepublish';
	if (pm === 'deno') return 'npm run vscode:prepublish';
	if (pm === 'yarn1') return 'yarn run vscode:prepublish';
	return pm + ' run vscode:prepublish'; // known pms
}

export async function getDependencies(
	cwd: string,
	dependencies: 'npm' | 'yarn' | 'none',
	packagedDependencies?: string[]
): Promise<string[]> {
	if (dependencies === 'none') {
		return [cwd];
	} else if (dependencies === 'yarn') {
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
