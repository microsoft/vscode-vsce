import * as pth from 'path';
import * as _glob from 'glob';
import * as denodeify from 'denodeify';
import * as child_process from 'child_process';

const glob = denodeify<string, _glob.IOptions, string[]>(_glob);


function flatten<T>(arr: T[][]): T[] {
	return [].concat.apply([], arr) as T[];
}

function globFiles(cwd: string, moduleDirs: string[]): Promise<string[]> {
	return Promise.all(moduleDirs.map(dir => glob('**', { cwd: dir, nodir: true, dot: true, ignore: "node_modules/**" })
				.then(filepaths => {
					return filepaths.map(filepath => pth.relative(cwd, pth.join(dir, filepath)))
						.map(filepath => filepath.replace(/\\/g, '/'))
				})))
		.then(moduleFiles => flatten(moduleFiles));
}

function npmProdDeps(cwd: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
       child_process.exec("npm list --production --parseable --depth", {cwd: cwd},
            (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                
                let moduleDirs = stdout.toString()
                    .split("\n")
                    .filter(dir => pth.isAbsolute(dir));
                
                resolve(moduleDirs);
            }
       )
        
    });
}

export function getDependencyFiles(cwd: string): Promise<string[]> {
	return npmProdDeps(cwd)
		.then(ps => globFiles(cwd, ps));
}