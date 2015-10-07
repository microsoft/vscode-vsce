import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest } from './manifest';
import { nfcall, Promise, reject, resolve, all } from 'q';
import * as glob from 'glob';
import * as minimatch from 'minimatch';
import { exec } from 'child_process';

const resourcesPath = path.join(path.dirname(__dirname), 'resources');
const vsixManifestTemplatePath = path.join(resourcesPath, 'extension.vsixmanifest');

export interface IFile {
	path: string;
	contents?: Buffer;
	localPath?: string;
}

export interface IPackageResult {
	manifest: Manifest;
	packagePath: string;
}

export function readManifest(cwd: string): Promise<Manifest> {
	const manifestPath = path.join(cwd, 'package.json');
	
	return nfcall<string>(fs.readFile, manifestPath, 'utf8')
		.catch(() => reject<string>(`Extension manifest not found: ${ manifestPath }`))
		.then<Manifest>(manifestStr => {
			try {
				return resolve(JSON.parse(manifestStr));
			} catch (e) {
				return reject(`Error parsing manifest file: not a valid JSON file.`);
			}
		});
}

function validateManifest(manifest: Manifest): Promise<Manifest> {
	if (!manifest.publisher) {
		return reject<Manifest>('Manifest missing field: publisher');
	}
	
	if (!manifest.name) {
		return reject<Manifest>('Manifest missing field: name');
	}
	
	if (!manifest.version) {
		return reject<Manifest>('Manifest missing field: version');
	}
	
	if (!manifest.engines) {
		return reject<Manifest>('Manifest missing field: engines');
	}
	
	if (!manifest.engines.vscode) {
		return reject<Manifest>('Manifest missing field: engines.vscode');
	}
	
	return resolve(manifest);
}

function prepublish(cwd: string, manifest: Manifest): Promise<Manifest> {
	if (!manifest.scripts || !manifest.scripts['vscode:prepublish']) {
		return resolve(manifest);
	}
	
	const script = manifest.scripts['vscode:prepublish'];
	console.warn(`Executing prepublish script '${ script }'...`);
	
	return nfcall<string>(exec, script, { cwd })
		.catch(err => reject(err.message))
		.spread((stdout: string, stderr: string) => {
			process.stdout.write(stdout);
			return resolve(manifest);
		});
}

function toVsixManifest(manifest: Manifest): Promise<string> {
	return nfcall<string>(fs.readFile, vsixManifestTemplatePath, 'utf8')
		.then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
		.then(vsixManifestTemplate => vsixManifestTemplate({
			id: manifest.name,
			displayName: manifest.name,
			version: manifest.version,
			publisher: manifest.publisher,
			description: manifest.description || '',
			tags: (manifest.keywords || []).concat('vscode').join(';')
		}));
}

const defaultIgnore = [
	'.vscodeignore',
	'**/.git/**',
	'**/*.vsix',
	'**/.DS_Store'
];

function devDependenciesIgnore(manifest: Manifest): string[] {
	const devDependencies = Object.keys(manifest.devDependencies || {});
	return devDependencies.map(d => `node_modules/${ d }/**`);
}

function collectFiles(cwd: string, manifest: Manifest): Promise<string[]> {
	return nfcall<string[]>(glob, '**', { cwd, nodir: true, dot: true }).then(files => {
		return nfcall<string>(fs.readFile, path.join(cwd, '.vscodeignore'), 'utf8')
			.catch<string>(err => err.code !== 'ENOENT' ? reject(err) : resolve(''))
			.then(rawIgnore => rawIgnore.split(/[\n\r]/).map(s => s.trim()).filter(s => !!s))
			.then(ignore => devDependenciesIgnore(manifest).concat(ignore))
			.then(ignore => defaultIgnore.concat(ignore))
			.then(ignore => ignore.filter(i => !/^\s*#/.test(i)))
			.then(ignore => _.partition(ignore, i => !/^\s*!/.test(i)))
			.spread((ignore: string[], negate: string[]) => files.filter(f => !ignore.some(i => minimatch(f, i)) || negate.some(i => minimatch(f, i.substr(1)))));
	});
}

export function collect(cwd: string, manifest: Manifest): Promise<IFile[]> {
	return all<any>([toVsixManifest(manifest), collectFiles(cwd, manifest)])
		.spread((vsixManifest: string, files: string[]) => [
			{ path: 'extension.vsixmanifest', contents: new Buffer(vsixManifest, 'utf8') },
			{ path: '[Content_Types].xml', localPath: path.join(resourcesPath, '[Content_Types].xml') },
			...files.map(f => ({ path: `extension/${ f }`, localPath: path.join(cwd, f) }))
		]);
}

function writeVsix(files: IFile[], packagePath: string): Promise<string> {
	return nfcall(fs.unlink, packagePath)
		.catch(err => err.code !== 'ENOENT' ? reject(err) : resolve(null))
		.then(() => Promise<string>((c, e) => {
			const zip = new yazl.ZipFile();
			files.forEach(f => f.contents ? zip.addBuffer(f.contents, f.path) : zip.addFile(f.localPath, f.path));
			zip.end();
			
			const zipStream = fs.createWriteStream(packagePath);
			zip.outputStream.pipe(zipStream);
			
			zip.outputStream.once('error', e);
			zipStream.once('error', e);
			zipStream.once('finish', () => c(packagePath));
		}));
}

function defaultPackagePath(cwd: string, manifest: Manifest): string {
	return path.join(cwd, `${ manifest.name }-${ manifest.version }.vsix`);
}

export function pack(packagePath?: string, cwd = process.cwd()): Promise<IPackageResult> {
	return readManifest(cwd)
		.then(validateManifest)
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collect(cwd, manifest)
			.then(files => writeVsix(files, packagePath || defaultPackagePath(cwd, manifest))
				.then(packagePath => ({ manifest, packagePath }))));
}

export function ls(cwd = process.cwd()): Promise<any> {
	return readManifest(cwd)
		.then(validateManifest)
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collectFiles(cwd, manifest))
		.then(files => files.forEach(f => console.log(`${f}`)));
}