import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import parseSemver from 'parse-semver';
import { CancellationToken, log, ndjsonToJson, nonnull } from './util';

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

interface Yarn2TreeNode {
	value: string;
	children: Yarn2TreeNodeChildren;
}

interface Yarn2TreeNodeChildren {
	Version: string;
	Dependencies: Yarn2Dependency[];
}

interface Yarn2Dependency {
	descriptor: string;
	locator: string;
}

export interface YarnDependency {
	name: string;
	path: string;
	children: YarnDependency[];
}

function isYarn2(tree: YarnTreeNode | Yarn2TreeNode | Yarn2Dependency): tree is Yarn2TreeNode | Yarn2Dependency {
	return (tree as Yarn2TreeNode).value !== undefined || (tree as Yarn2Dependency).descriptor !== undefined;
}

function asYarnDependency(prefix: string, tree: YarnTreeNode | Yarn2TreeNode, prune: boolean): YarnDependency | null {
	const isY2 = isYarn2(tree);
	const packageName = isY2 ? tree.value : tree.name;

	if (prune && /@[\^~]/.test(packageName)) {
		return null;
	}

	let name: string;

	try {
		const parseResult = parseSemver(packageName);
		name = parseResult.name;
	} catch (err) {
		name = packageName.replace(/^(.*)@.*$/, '$1');
	}

	const dependencyPath = path.join(prefix, name);
	const children: YarnDependency[] = [];

	for (const child of (isY2 ? tree.children.Dependencies : (tree.children as YarnTreeNode[])) || []) {
		const isChildY2 = isYarn2(child);
		const childDep = isChildY2
			? ({
					value: child.locator,
					children: {},
			  } as Yarn2TreeNode)
			: ({
					name: child.name,
			  } as YarnTreeNode);

		const dep = asYarnDependency(path.join(prefix, name, 'node_modules'), childDep, prune);

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
	const [major] = (
		await new Promise<string>((c, e) =>
			cp.exec(
				'yarn --version',
				{ cwd, encoding: 'utf8', env: { ...process.env }, maxBuffer: 5000 * 1024 },
				(err, stdout) => (err ? e(err) : c(stdout))
			)
		)
	)
		.split('.')
		.map(parseInt);

	const isY2 = major > 1;
	const listCommand = isY2 ? 'yarn info --recursive --dependents --json' : 'yarn list --prod --json --depth 99999';

	let raw = await new Promise<string>((c, e) =>
		cp.exec(listCommand, { cwd, encoding: 'utf8', env: { ...process.env }, maxBuffer: 5000 * 1024 }, (err, stdout) =>
			err ? e(err) : c(stdout)
		)
	);

	if (isY2) {
		raw = ndjsonToJson(raw);
	}

	const match = (isY2 ? /^\[{"value":".*$/m : /^{"type":"tree".*$/m).exec(raw);

	if (!match || match.length !== 1) {
		throw new Error(`Could not parse result of \`${listCommand}\``);
	}

	const usingPackagedDependencies = Array.isArray(packagedDependencies);
	const trees = isY2 ? (JSON.parse(match[0]) as Yarn2TreeNode[]) : (JSON.parse(match[0]).data.trees as YarnTreeNode[]);

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
	console.log(await getYarnDependencies(cwd, packagedDependencies));
	console.log(await getNpmDependencies(cwd));
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
