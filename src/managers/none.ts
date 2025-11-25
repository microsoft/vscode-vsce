import type { IPackageManager } from "./manager";
import { pmNPM } from './npm';

export const pmNone: IPackageManager = {
	binaryName: "",

	selfVersion: pmNPM.selfVersion.bind(pmNPM),
	selfCheck: pmNPM.selfCheck.bind(pmNPM),

	commandRun: pmNPM.commandRun.bind(pmNPM),
	commandInstall: pmNPM.commandInstall.bind(pmNPM),

	pkgRequestLatest: pmNPM.pkgRequestLatest.bind(pmNPM),
	async pkgProdDependencies(cwd: string, _?: string[]): Promise<string[]> {
		return [cwd]
	}
}