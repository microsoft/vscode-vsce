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

async function mapSymlinkedDependencies(cwd: string, deps: string[]): Promise<string[]> {
	// Build two maps:
	// 1. resolved target → symlink path (for direct symlinks)
	// 2. resolved target → symlink path (for prefix matching nested deps)
	const symlinkMap = new Map<string, string>();
	const targetMap = new Map<string, string>(); // for prefix-based replacement
	const nodeModulesBase = path.join(cwd, 'node_modules');

	try {
		// Scan for symlinks at the top level
		const entries = await fs.promises.readdir(nodeModulesBase, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(nodeModulesBase, entry.name);
			
			// Check scoped packages
			if (entry.isDirectory() && entry.name.startsWith('@')) {
				try {
					const scopedEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });
					for (const scopedEntry of scopedEntries) {
						const scopedPath = path.join(fullPath, scopedEntry.name);
						if (scopedEntry.isSymbolicLink()) {
							try {
								const target = await fs.promises.realpath(scopedPath);
								symlinkMap.set(target, scopedPath);
								targetMap.set(target, scopedPath);
							} catch (e) {
								// ignore broken symlinks
							}
						}
					}
				} catch (e) {
					// ignore unreadable scoped dirs
				}
			} else if (entry.isSymbolicLink()) {
				try {
					const target = await fs.promises.realpath(fullPath);
					symlinkMap.set(target, fullPath);
					targetMap.set(target, fullPath);
				} catch (e) {
					// ignore broken symlinks
				}
			}
		}
	} catch (e) {
		// ignore if node_modules doesn't exist
	}

	// Map each dependency: check direct symlink match, or prefix match for nested deps
	const mapped = deps.map(dep => {
		// Direct match
		if (symlinkMap.has(dep)) {
			return symlinkMap.get(dep)!;
		}
		
		// Prefix match: if dep is inside a known symlink target, replace the prefix
		for (const [target, symlink] of targetMap) {
			if (dep.startsWith(target + path.sep)) {
				const suffix = dep.slice((target + path.sep).length);
				return path.join(symlink, suffix);
			}
		}
		
		return dep;
	});

	// Deduplicate: remove dependencies that are nested within another dependency's node_modules
	// Only apply deduplication if we found symlinks, otherwise return mapped deps as-is
	if (symlinkMap.size === 0) {
		return mapped;
	}

	const sorted = mapped.sort();
	const result = [];
	for (const dep of sorted) {
		// Check if this dep is inside any already-added dependency's node_modules
		let isNested = false;
		for (const existing of result) {
			// Only consider it nested if the existing dep is a package (contains /node_modules/)
			// and dep is inside that package's node_modules
			if (existing.includes('/node_modules/') || existing.includes(path.sep + 'node_modules' + path.sep)) {
				const nestedPath = path.join(existing, 'node_modules');
				if (dep.startsWith(nestedPath + path.sep)) {
					isNested = true;
					break;
				}
			}
		}
		if (!isNested) {
			result.push(dep);
		}
	}
	
	return result;
}

function getNpmDependencies(cwd: string): Promise<string[]> {
	return checkNPM()
		.then(() => exec('npm list --production --parseable --depth=99999 --loglevel=error', { cwd, maxBuffer: 5000 * 1024 }))
		.then(({ stdout }) => stdout.split(/[\r\n]/).filter(dir => path.isAbsolute(dir)))
		.then(deps => mapSymlinkedDependencies(cwd, deps));
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

	return mapSymlinkedDependencies(cwd, [...result]);
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

export async function getDependencies(
	cwd: string,
	dependencies: 'npm' | 'yarn' | 'none' | undefined,
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
