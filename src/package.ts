import { readFile, createWriteStream } from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest } from './manifest';
import { nfcall, Promise, reject, resolve } from 'q';

const resourcesPath = path.join(path.dirname(__dirname), 'resources');
const vsixManifestTemplatePath = path.join(resourcesPath, 'extension.vsixmanifest');

function readManifest(root: string): Promise<Manifest> {
	const manifestPath = path.join(root, 'package.json');
	
	return nfcall<string>(readFile, manifestPath, 'utf8')
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
	if (!manifest.name) {
		return reject<Manifest>('Manifest missing field: name');
	}
	
	if (!manifest.version) {
		return reject<Manifest>('Manifest missing field: version');
	}
	
	if (!manifest.publisher) {
		return reject<Manifest>('Manifest missing field: publisher');
	}
	
	if (!manifest.engines) {
		return reject<Manifest>('Manifest missing field: engines');
	}
	
	if (!manifest.engines.vscode) {
		return reject<Manifest>('Manifest missing field: engines.vscode');
	}
	
	return resolve(manifest);
}

function toVsixManifest(manifest: Manifest): Promise<string> {
	return nfcall<string>(readFile, vsixManifestTemplatePath, 'utf8')
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

function writeVsix(packagePath: string, vsixManifest: string): Promise<void> {
	return Promise<void>((c, e) => {
		const zip = new yazl.ZipFile();
		zip.addBuffer(new Buffer(vsixManifest, 'utf8'), 'extension.vsixmanifest');
		zip.addFile(path.join(resourcesPath, '[Content_Types].xml'), '[Content_Types].xml');
		zip.addBuffer(new Buffer('hello world', 'utf8'), 'hello.txt');
		zip.end();
		
		const zipStream = createWriteStream(packagePath);
		zip.outputStream.pipe(zipStream);
		zip.outputStream.once('error', e);
		zip.outputStream.once('end', c);
	});
}

function defaultPackagePath(root: string, manifest: Manifest) {
	return path.join(root, `${ manifest.name }-${ manifest.version }.vsix`);
}

export = function (packagePath?: string, root = process.cwd()): Promise<any> {
	return readManifest(root)
		.then(validateManifest)
		.then(manifest => {
			packagePath = packagePath || defaultPackagePath(root, manifest);
			
			return toVsixManifest(manifest)
				.then(vsixManifest => writeVsix(packagePath, vsixManifest))
				.then(() => console.log(`Package created: ${ path.resolve(packagePath) }`));
		});
};