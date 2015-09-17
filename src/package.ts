import * as fs from 'fs';
import { dirname, join, resolve } from 'path';
import * as _ from 'lodash';
import * as yazl from 'yazl';

export = function (path?: string) {
	const resourcesPath = join(dirname(__dirname), 'resources');
	const manifestTemplatePath = join(resourcesPath, 'extension.vsixmanifest');
	const manifestTemplateStr = fs.readFileSync(manifestTemplatePath, 'utf8');
	const manifestTemplate = _.template(manifestTemplateStr);
	
	const manifest = {
		id: 'uuid',
		displayName: 'UUID',
		version: '0.2.0',
		publisher: 'joaomoreno2',
		description: 'This is a UUID extension',
		tags: 'VSCode'
	};
	
	const manifestStr = manifestTemplate(manifest);
	
	const zip = new yazl.ZipFile();
	zip.addBuffer(new Buffer(manifestStr, 'utf8'), 'extension.vsixmanifest');
	zip.addFile(join(resourcesPath, '[Content_Types].xml'), '[Content_Types].xml');
	zip.addBuffer(new Buffer('hello world', 'utf8'), 'hello.txt');
	zip.end();
	
	if (!path) {
		path = join(process.cwd(), `${ manifest.id }-${ manifest.version }.vsix`);
	}
	
	const zipStream = fs.createWriteStream(path);
	zip.outputStream.pipe(zipStream);
	
	console.log(`Package created: ${ resolve(path) }`);
};