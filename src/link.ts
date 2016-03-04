import * as _read from 'read';
import * as fs from 'fs';
import * as path from 'path';
import * as util from './util';

export function linkPlugin(dir : string, targ : string) : Promise<any> {
	return new Promise((c, e) => {
		let packagePath = dir || "."
		let target = targ || "stable"
		
		let linkPath = path.resolve(process.cwd(), packagePath)
		
		let packageName = ""
		try {
			let p = JSON.parse(fs.readFileSync(path.join(linkPath, 'package.json')).toString())
			packageName = `${p.publisher}.${p.name}`
		} catch (error) {
			packageName = path.basename(linkPath)
		}
		let targetFolder = ".vscode"
		if (target.toLowerCase() === "insiders")
		{
			targetFolder = ".vscode-insiders" 
		}
		if (target.toLowerCase() === "alpha")
		{
			targetFolder = ".vscode-insiders" //TODO
		}
		if (target.toLowerCase() === "oss")
		{
			targetFolder = ".vscode-insiders" //TODO
		}
		if (target.toLowerCase() === "ossbuilt")
		{
			targetFolder = ".vscode-insiders" //TODO
		}
		let targetPath = path.join(util.getHomeDirectory(), targetFolder, 'extensions', packageName)
		try {
			fs.symlinkSync(linkPath, targetPath, 'junction')
			console.log(`Linked ${targetPath} -> ${linkPath}`)
		} catch (error) {
			throw new Error(`Creating symlink ${targetPath} -> ${linkPath} failed`)
		}
		
		
	})
}