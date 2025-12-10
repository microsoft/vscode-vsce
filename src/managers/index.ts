import { PackageManager } from "./manager";
import { pmNone } from "./none";
import { pmNPM } from "./npm";
import { pmYarn } from "./yarn";

// Reminder: scr/api.ts (PackageManager enum).
const managers = ['none', 'npm', 'yarn'] as const
export const Managers = new Set(managers);
export type PackageManagerLiteral = typeof managers[number];

/**
 * Get package manager by preference.
 * @returns Package manager implementation.
 */
export function getPackageManager(
	preference: PackageManagerLiteral = "npm",
): PackageManager {
	const choice = {
		"none": pmNone,
		"npm": pmNPM,
		"yarn": pmYarn,
	} as Record<PackageManagerLiteral, PackageManager>

	return choice[preference]
}

/**
 * Throws only for strings that are not valid package managers.
 * `undefiend` is allowed.
 */
export function assertPackageManager(packageManager: string | undefined): asserts packageManager is PackageManagerLiteral | undefined {
	if (packageManager === undefined) {
		return
	}
	if (!Managers.has(packageManager as PackageManagerLiteral)) {
		throw new Error(`'${packageManager}' is not a supported package manager. Valid managers: ${[...Managers].join(', ')}`);
	}
}