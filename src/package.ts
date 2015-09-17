import { readFile, createWriteStream } from 'fs';
import { dirname, join, resolve } from 'path';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest, VsixManifest } from './manifest';
import { nfcall, Promise, reject } from 'q';

function validate(manifest: Manifest): string {
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

export = function (path?: string): Promise<any> {
	const manifestPath = join(process.cwd(), 'package.json');
	
	return nfcall<string>(readFile, manifestPath, 'utf8')
		.catch(() => reject<string>(`Extension manifest not found: ${ manifestPath }`))
		.then<Manifest>(manifestStr => {
			try {
				return JSON.parse(manifestStr);
			} catch (e) {
				return reject<Manifest>(`Error parsing manifest file: not a valid JSON file.`);
			}
		})
		.then(manifest => {
			const validation = validate(manifest);
			
			if (validation) {
				return reject<void>(validation);
			}

			const resourcesPath = join(dirname(__dirname), 'resources');
			const vsixManifestTemplatePath = join(resourcesPath, 'extension.vsixmanifest');
			
			return nfcall<string>(readFile, vsixManifestTemplatePath, 'utf8')
				.then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
				.then(vsixManifestTemplate => vsixManifestTemplate(toVsixManifest(manifest)))
				.then(vsixManifestStr => Promise<void>((c, e) => {
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
					zip.outputStream.once('error', e);
					zip.outputStream.once('end', c);
				}));
		})
		.then(() => console.log(`Package created: ${ resolve(path) }`));
};