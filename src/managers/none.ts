import type { IPackageManager } from "./manager";
import { pmNPM } from './npm';

export const pmNone: IPackageManager = {
	binaryName: "",
	selfVersion: pmNPM.selfVersion.bind(pmNPM),
	selfCheck: pmNPM.selfCheck.bind(pmNPM),
	pmRunCommand: pmNPM.pmRunCommand.bind(pmNPM),
	pmInstallCommand: pmNPM.pmInstallCommand.bind(pmNPM),
	async pmProdDependencies(cwd: string, _?: string[]): Promise<string[]> {
		return [cwd]
	},
	pmFetchLatestVersion: pmNPM.pmFetchLatestVersion.bind(pmNPM),
}