import { PackageManagerNpm } from './npm';

class PackageManagerNone extends PackageManagerNpm {
	binaryName = ""

	async pkgProdDependencies(cwd: string, _?: string[]): Promise<string[]> {
		return [cwd]
	}
}

export const pmNone = new PackageManagerNone()
