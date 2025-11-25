import { CancellationToken } from "../util";
import { pmNone } from "./none";
import { pmNPM } from "./npm";
import { pmYarn } from "./yarn";

// Reminder: scr/api.ts (PackageManager enum).
const managers = ['none', 'npm', 'yarn'] as const
export const Managers = new Set(managers);
export type PackageManagerLiteral = typeof managers[number];

export interface IPackageManager {
	binaryName: string;
	selfVersion(cancellationToken?: CancellationToken): Promise<string>;
	selfCheck(cancellationToken?: CancellationToken): Promise<void>;
	pmRunCommand(scriptName: string): string;
	pmInstallCommand(packageName: string, global: boolean): string;
	pmFetchLatestVersion(name: string, cancellationToken?: CancellationToken): Promise<string>;
	pmProdDependencies(cwd: string, packagedDependencies?: string[]): Promise<string[]>;
}

export function getPackageManager(
	preference: PackageManagerLiteral = "npm",
): IPackageManager {
	const choice = {
		"none": pmNone,
		"npm": pmNPM,
		"yarn": pmYarn,
	} as Record<PackageManagerLiteral, IPackageManager>

	return choice[preference]
}
