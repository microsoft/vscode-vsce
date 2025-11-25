import * as path from 'path';
import * as cp from "child_process";
import { type CancellationToken, nonnull } from '../util';
import type { IPackageManager } from "./manager";
import parseSemver from 'parse-semver';
import { exec } from './exec';

export const pmYarn: IPackageManager = {
	binaryName: 'yarn',

	async selfVersion(cancellationToken?: CancellationToken): Promise<string> {
		const { stdout } = await exec('yarn -v', {}, cancellationToken);
		return stdout.trim();
	},
	async selfCheck(cancellationToken?: CancellationToken): Promise<void> {
		const version = await this.selfVersion(cancellationToken);
		if (!version.startsWith("1")) {
			throw new Error(`yarn@${version} doesn't work with vsce. Please update yarn: npm install -g yarn`);
		}
	},

	commandRun(scriptName: string): string {
		return `${this.binaryName} run ${scriptName}`;
	},
	commandInstall(pkg: string, global: boolean): string {
		let flag = (global ? 'global' : '')
		flag &&= flag + " "
		return `${this.binaryName} ${flag}add ${pkg}`
	},

	async pkgRequestLatest(name: string, cancellationToken?: CancellationToken): Promise<string> {
		await this.selfCheck(cancellationToken)
		const { stdout } = await exec(`yarn info ${name} version`, {}, cancellationToken)
		return stdout.split(/[\r\n]/).filter(line => !!line)[1];
	},
	async pkgProdDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]> {
	async pmProdDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]> {
		const result = new Set([cwd]);

		const deps = await getYarnProductionDependencies(cwd, packagedDependencies);
		const flatten = (dep: YarnDependency) => {
			result.add(dep.path);
			dep.children.forEach(flatten);
		};
		deps.forEach(flatten);

		return [...result];
	}
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
