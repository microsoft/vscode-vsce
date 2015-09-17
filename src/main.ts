import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import * as yazl from 'yazl';

var templatePath = path.join(__dirname, 'resources', 'extension.vsixmanifest');
var vsixmanifest = fs.readFileSync(templatePath, 'utf8');
var template = _.template(vsixmanifest);
var result = template({
	id: 'uuid',
	displayName: 'UUID',
	version: '0.2.0',
	publisher: 'joaomoreno2',
	description: 'This is a UUID extension',
	tags: 'VSCode'
});

var zip = new yazl.ZipFile();
zip.addBuffer(new Buffer(result, 'utf8'), 'extension.vsixmanifest');
zip.addFile(path.join(__dirname, 'resources', '[Content_Types].xml'), '[Content_Types].xml');
zip.addBuffer(new Buffer('hello world', 'utf8'), 'hello.txt');
zip.end();

var zipStream = fs.createWriteStream(path.join(__dirname, 'uuid.vsix'));
zip.outputStream.pipe(zipStream);
