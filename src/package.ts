import { existsSync, readFileSync, createWriteStream } from 'fs';
import { dirname, join, resolve } from 'path';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest, VsixManifest } from './manifest';
import { fatal } from './util';

const resourcesPath = join(dirname(__dirname), 'resources');
const vsixManifestTemplatePath = join(resourcesPath, 'extension.vsixmanifest');
const vsixManifestTemplateStr = readFileSync(vsixManifestTemplatePath, 'utf8');
const vsixManifestTemplate = _.template(vsixManifestTemplateStr);

function validate(manifest: any): string {
	if (!manifest.name) {
		return 'Manifest missing field: name';
	}
	
	if (!manifest.version) {
		return 'Manifest missing field: version';
	}
	
	if (!manifest.publisher) {
		return 'Manifest missing field: publisher';
	}
	
	if (!manifest.engines) {
		return 'Manifest missing field: engines';
	}
	
	if (!manifest.engines.vscode) {
		return 'Manifest missing field: engines.vscode';
	}
	
	return null;
}

function toVsixManifest(manifest: Manifest): VsixManifest {
	return {
		id: manifest.name,
		displayName: manifest.name,
		version: manifest.version,
		publisher: manifest.publisher,
		description: manifest.description || '',
		tags: (manifest.keywords || []).concat('vscode').join(';')
	};
}

export = function (path?: string): void {
	const manifestPath = join(process.cwd(), 'package.json');
	let manifestStr: string;
	
	try {
		manifestStr = readFileSync(manifestPath, 'utf8');
	} catch (e) {
		return fatal(`Extension manifest not found: ${ manifestPath }`);
	}
	
	let manifest: any;
	
	try {
		manifest = JSON.parse(manifestStr);
	} catch (e) {
		return fatal(`Error parsing JSON: ${ manifestPath }`);
	}
	
	const validation = validate(manifest);
	
	if (validation) {
		return fatal(validation);
	}
	
	const vsixManifest = toVsixManifest(manifest);
	const vsixManifestStr = vsixManifestTemplate(vsixManifest);
	
	const zip = new yazl.ZipFile();
	zip.addBuffer(new Buffer(vsixManifestStr, 'utf8'), 'extension.vsixmanifest');
	zip.addFile(join(resourcesPath, '[Content_Types].xml'), '[Content_Types].xml');
	zip.addBuffer(new Buffer('hello world', 'utf8'), 'hello.txt');
	zip.end();
	
	if (!path) {
		path = join(process.cwd(), `${ manifest.name }-${ manifest.version }.vsix`);
	}
	
	const zipStream = createWriteStream(path);
	zip.outputStream.pipe(zipStream);
	
	console.log(`Package created: ${ resolve(path) }`);
};