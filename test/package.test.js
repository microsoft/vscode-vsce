/*global describe,it*/

import { readManifest, collect, toVsixManifest } from '../out/package';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { parseString } from 'xml2js';
import * as _denodeify from 'denodeify';
const denodeify = _denodeify['default'];
const parseXml = denodeify(parseString);

const fixture = name => path.join(__dirname, 'fixtures', name);

describe('collect', () => {
	
	it('should catch all files', cb => {
		const cwd = fixture('uuid');
		
		readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 3);
				cb();
			})
			.catch(cb);
	});
	
	it('should ignore .git/**', cb => {
		const cwd = fixture('uuid');
		
		if (!fs.existsSync(path.join(cwd, '.git'))) {
			fs.mkdirSync(path.join(cwd, '.git'));
		}
		
		if (!fs.existsSync(path.join(cwd, '.git', 'hello'))) {
			fs.writeFileSync(path.join(cwd, '.git', 'hello'), 'world');
		}
		
		readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 3);
				cb();
			})
			.catch(cb);
	});
	
	it('should ignore devDependencies', cb => {
		const cwd = fixture('devDependencies');
		
		readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 4);
				assert.ok(files.some(f => /real\/dependency\.js/.test(f.path)));
				assert.ok(!files.some(f => /fake\/dependency\.js/.test(f.path)));
				cb();
			})
			.catch(cb);
	});
});

describe('toVsixManifest', () => {
	it('should produce a good xml', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension'
		};
		
		return toVsixManifest(manifest)
			.then(xml => parseXml(xml))
			.then(result => {
				assert.ok(result);
				assert.ok(result.PackageManifest);
				assert.ok(result.PackageManifest.$);
				assert.equal(result.PackageManifest.$.Version, '2.0.0');
				assert.equal(result.PackageManifest.$.xmlns, 'http://schemas.microsoft.com/developer/vsx-schema/2011');
				assert.equal(result.PackageManifest.$['xmlns:d'], 'http://schemas.microsoft.com/developer/vsx-schema-design/2011');
				assert.ok(result.PackageManifest.Metadata);
				assert.equal(result.PackageManifest.Metadata.length, 1);
				assert.equal(result.PackageManifest.Metadata[0].Description[0]._, 'test extension');
				assert.equal(result.PackageManifest.Metadata[0].DisplayName[0], 'test');
				assert.equal(result.PackageManifest.Metadata[0].Identity[0].$.Id, 'test');
				assert.equal(result.PackageManifest.Metadata[0].Identity[0].$.Version, '0.0.1');
				assert.equal(result.PackageManifest.Metadata[0].Identity[0].$.Publisher, 'mocha');
				assert.deepEqual(result.PackageManifest.Metadata[0].Tags, ['vscode']);
				assert.deepEqual(result.PackageManifest.Metadata[0].GalleryFlags, ['Public']);
				assert.equal(result.PackageManifest.Installation.length, 1);
				assert.equal(result.PackageManifest.Installation[0].InstallationTarget.length, 1);
				assert.equal(result.PackageManifest.Installation[0].InstallationTarget[0].$.Id, 'Microsoft.VisualStudio.Code');
				assert.deepEqual(result.PackageManifest.Dependencies, ['']);
				assert.equal(result.PackageManifest.Assets.length, 1);
				assert.equal(result.PackageManifest.Assets[0].Asset.length, 1);
				assert.equal(result.PackageManifest.Assets[0].Asset[0].$.Type, 'Microsoft.VisualStudio.Code.Manifest');
				assert.equal(result.PackageManifest.Assets[0].Asset[0].$.Path, 'extension/package.json');
			});
	});
});