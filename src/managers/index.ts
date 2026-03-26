import { PackageManagerImpl } from "./manager";
import { pmNone } from "./none";
import { pmNPM } from "./npm";
import { pmYarn } from "./yarn";

// Reminder: scr/api.ts (PackageManager enum).
const managers = ['none', 'npm', 'yarn'] as const
/**
 * The supported list of package managers.
 * @public
 */
export enum PackageManager {
	Npm,
	Yarn,
	None,
}
export const Managers = new Set(managers);
/**
 * @internal Use {@link PackageManager} for public API.
 */
export type PackageManagerLiteral = typeof managers[number];


export function getPackageManagerEnum(
	preference: PackageManagerLiteral | PackageManager = PackageManager.None,
): PackageManager {
	const choice = {
		"none": PackageManager.None,
		"npm": PackageManager.Npm,
		"yarn": PackageManager.Yarn,
	} as Record<PackageManager | PackageManagerLiteral, PackageManager>

	return choice[preference];
}

/**
 * Get package manager by preference.
 * @returns Package manager implementation.
 */
export function getPackageManager(
	preference: PackageManager | PackageManagerLiteral = PackageManager.None,
): PackageManagerImpl {
	const pref = getPackageManagerEnum(preference)
	const choice = {
		[PackageManager.None]: pmNone,
		[PackageManager.Npm]: pmNPM,
		[PackageManager.Yarn]: pmYarn,
	} as Record<PackageManager, PackageManagerImpl>

	return choice[pref];
}

/**
 * Throws only for strings that are not valid package managers.
 * `undefiend` is allowed.
 */
export function assertPackageManager(packageManager: any): asserts packageManager is PackageManagerLiteral | undefined {
	if (packageManager === undefined) {
		return
	}
	if (!Managers.has(packageManager)) {
		throw new Error(`'${packageManager}' is not a supported package manager. Valid managers: ${[...Managers].join(', ')}`);
	}
}