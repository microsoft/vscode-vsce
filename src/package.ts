import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest } from './manifest';
import * as _glob from 'glob';
import * as minimatch from 'minimatch';
import * as denodeify from 'denodeify';
import * as mime from 'mime';

const readFile = denodeify<string, string, string>(fs.readFile);
const unlink = denodeify<string, void>(fs.unlink);
const exec = denodeify<string, { cwd?: string; }, { stdout: string; stderr: string; }>(cp.exec, (err, stdout, stderr) => [err, { stdout, stderr }]);
const glob = denodeify<string, _glob.IOptions, string[]>(_glob);

const resourcesPath = path.join(path.dirname(__dirname), 'resources');
const vsixManifestTemplatePath = path.join(resourcesPath, 'extension.vsixmanifest');
const contentTypesTemplatePath = path.join(resourcesPath, '[Content_Types].xml');

export interface IFile {
	path: string;
	contents?: Buffer;
}

export interface IPackageResult {
	manifest: Manifest;
	packagePath: string;
}

export interface IAsset {
	type: string;
	path: string;
}

function validateManifest(manifest: Manifest): Promise<Manifest> {
	if (!manifest.publisher) {
		return Promise.reject('Manifest missing field: publisher');
	}
	
	if (!manifest.name) {
		return Promise.reject('Manifest missing field: name');
	}
	
	if (!manifest.version) {
		return Promise.reject('Manifest missing field: version');
	}
	
	if (!manifest.engines) {
		return Promise.reject('Manifest missing field: engines');
	}
	
	if (!manifest.engines['vscode']) {
		return Promise.reject('Manifest missing field: engines.vscode');
	}
	
	return Promise.resolve(manifest);
}

export function readManifest(cwd: string): Promise<Manifest> {
	const manifestPath = path.join(cwd, 'package.json');
	
	return readFile(manifestPath, 'utf8')
		.catch(() => Promise.reject(`Extension manifest not found: ${ manifestPath }`))
		.then<Manifest>(manifestStr => {
			try {
				return Promise.resolve(JSON.parse(manifestStr));
			} catch (e) {
				return Promise.reject(`Error parsing manifest file: not a valid JSON file.`);
			}
		})
		.then(validateManifest);
}

function prepublish(cwd: string, manifest: Manifest): Promise<Manifest> {
	if (!manifest.scripts || !manifest.scripts['vscode:prepublish']) {
		return Promise.resolve(manifest);
	}
	
	const script = manifest.scripts['vscode:prepublish'];
	console.warn(`Executing prepublish script '${ script }'...`);
	
	return exec(script, { cwd })
		.then(({ stdout }) => {
			process.stdout.write(stdout);
			return Promise.resolve(manifest);
		})
		.catch(err => Promise.reject(err.message));
}

function getLicenseFilter(manifest:Manifest): (name: string) => boolean {
	const match = /^SEE LICENSE IN (.*)$/.exec(manifest.license || '');
	
	if (!match || !match[1]) {
		return () => false;
	}
	
	const regexp = new RegExp('^extension/' + match[1] + '$');
	return regexp.test.bind(regexp);
}

export function toVsixManifest(manifest: Manifest, files: IFile[]): Promise<string> {
	const licenseFilter = getLicenseFilter(manifest);
	
	const assets = files.map<IAsset>(f => {
		if (/^extension\/README.md$/i.test(f.path)) {
			return { type: 'Microsoft.VisualStudio.Services.Content.Details', path: f.path };
		}
		
		if (licenseFilter(f.path)) {
			return { type: 'Microsoft.VisualStudio.Services.Content.License', path: f.path };
		}
		
		return null;
	}).filter(f => !!f);
	
	return readFile(vsixManifestTemplatePath, 'utf8')
		.then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
		.then(vsixManifestTemplate => vsixManifestTemplate({
			id: manifest.name,
			displayName: manifest.name,
			version: manifest.version,
			publisher: manifest.publisher,
			description: manifest.description || '',
			tags: (manifest.keywords || []).concat('vscode').join(';'),
			assets
		}));
}

export function toContentTypes(files: IFile[]): Promise<string> {
	const extensions = Object.keys(_.indexBy(files, f => path.extname(f.path)))
		.map(e => e.toLowerCase())
		.filter(e => e && !_.contains(['.json', '.vsixmanifest'], e));
	
	const contentTypes = extensions
		.map(extension => ({ extension, contentType: mime.lookup(extension) }));
	
	return readFile(contentTypesTemplatePath, 'utf8')
		.then(contentTypesTemplateStr => _.template(contentTypesTemplateStr))
		.then(contentTypesTemplate => contentTypesTemplate({ contentTypes }));
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
	return glob('**', { cwd, nodir: true, dot: true }).then(files => {
		return readFile(path.join(cwd, '.vscodeignore'), 'utf8')
			.catch<string>(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(''))
			.then(rawIgnore => rawIgnore.split(/[\n\r]/).map(s => s.trim()).filter(s => !!s))
			.then(ignore => devDependenciesIgnore(manifest).concat(ignore))
			.then(ignore => defaultIgnore.concat(ignore))
			.then(ignore => ignore.filter(i => !/^\s*#/.test(i)))
			.then<{ ignore: string[]; negate: string[]; }>(ignore => <any> _.indexBy(_.partition(ignore, i => !/^\s*!/.test(i)), (o, i) => i ? 'negate' : 'ignore'))
			.then(({ ignore, negate }) => files.filter(f => !ignore.some(i => minimatch(f, i)) || negate.some(i => minimatch(f, i.substr(1)))));
	});
}

export function collect(cwd: string, manifest: Manifest): Promise<IFile[]> {
	return collectFiles(cwd, manifest).then(fileNames => {
		const files = fileNames.map(f => ({ path: `extension/${ f }` }));
		
		return Promise.all([toVsixManifest(manifest, files), toContentTypes(files)])
			.then(result => [
				{ path: 'extension.vsixmanifest', contents: new Buffer(result[0], 'utf8') },
				{ path: '[Content_Types].xml', contents: new Buffer(result[1], 'utf8') },
				...files
			]);
	});
}

function writeVsix(files: IFile[], packagePath: string): Promise<string> {
	return unlink(packagePath)
		.catch(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(null))
		.then(() => new Promise<string>((c, e) => {
			const zip = new yazl.ZipFile();
			files.forEach(f => zip.addBuffer(f.contents, f.path));
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
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collect(cwd, manifest)
			.then(files => writeVsix(files, packagePath || defaultPackagePath(cwd, manifest))
				.then(packagePath => ({ manifest, packagePath }))));
}

export function ls(cwd = process.cwd()): Promise<any> {
	return readManifest(cwd)
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collectFiles(cwd, manifest))
		.then(files => files.forEach(f => console.log(`${f}`)));
}