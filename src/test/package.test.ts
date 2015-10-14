import { readManifest, collect, toVsixManifest, toContentTypes } from '../package';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { parseString } from 'xml2js';
import * as denodeify from 'denodeify';

const parseXml = denodeify<string,any>(parseString);
const fixture = name => path.join(__dirname, 'fixtures', name);

describe('collect', () => {
	
	it('should catch all files', () => {
		const cwd = fixture('uuid');
		
		return readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 3);
			});
	});
	
	it('should ignore .git/**', () => {
		const cwd = fixture('uuid');
		
		if (!fs.existsSync(path.join(cwd, '.git'))) {
			fs.mkdirSync(path.join(cwd, '.git'));
		}
		
		if (!fs.existsSync(path.join(cwd, '.git', 'hello'))) {
			fs.writeFileSync(path.join(cwd, '.git', 'hello'), 'world');
		}
		
		return readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 3);
			});
	});
	
	it('should ignore devDependencies', () => {
		const cwd = fixture('devDependencies');
		
		return readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 4);
				assert.ok(files.some(f => /real\/dependency\.js/.test(f.path)));
				assert.ok(!files.some(f => /fake\/dependency\.js/.test(f.path)));
			});
	});
});

describe('toVsixManifest', () => {
	it('should produce a good xml', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null)
		};
		
		return toVsixManifest(manifest, [])
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
	
	it('should treat README.md as asset', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null)
		};
		
		const files = [
			{ path: 'extension/readme.md' }
		];
		
		return toVsixManifest(manifest, files)
			.then(xml => parseXml(xml))
			.then(result => {
				assert.equal(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.equal(result.PackageManifest.Assets[0].Asset[1].$.Type, 'Microsoft.VisualStudio.Services.Content.Details');
				assert.equal(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/readme.md');
			});
	});
	
	it('should treat any license file as asset', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			license: 'SEE LICENSE IN thelicense.md',
			engines: Object.create(null)
		};
		
		const files = [
			{ path: 'extension/thelicense.md' }
		];
		
		return toVsixManifest(manifest, files)
			.then(xml => parseXml(xml))
			.then(result => {
				assert.equal(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.equal(result.PackageManifest.Assets[0].Asset[1].$.Type, 'Microsoft.VisualStudio.Services.Content.License');
				assert.equal(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/thelicense.md');
			});
	});
	
	it('should add a license metadata tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			license: 'SEE LICENSE IN thelicense.md',
			engines: Object.create(null)
		};
		
		const files = [
			{ path: 'extension/thelicense.md' }
		];
		
		return toVsixManifest(manifest, files)
			.then(xml => parseXml(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].License);
				assert.equal(result.PackageManifest.Metadata[0].License.length, 1);
				assert.equal(result.PackageManifest.Metadata[0].License[0], 'extension/thelicense.md');
			});
	});
	
	it('should add homepage link property', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			homepage: 'https://homepage/test'
		};
		
		return toVsixManifest(manifest, [])
			.then(xml => parseXml(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].Properties);
				assert.equal(result.PackageManifest.Metadata[0].Properties.length, 1);
				assert.ok(result.PackageManifest.Metadata[0].Properties[0].Property);
				assert.equal(result.PackageManifest.Metadata[0].Properties[0].Property.length, 1);
				assert.equal(result.PackageManifest.Metadata[0].Properties[0].Property[0].$.Id, 'Microsoft.VisualStudio.Services.Links.Source');
				assert.equal(result.PackageManifest.Metadata[0].Properties[0].Property[0].$.Value, 'https://homepage/test');
			});
	});
});

describe('toContentTypes', () => {
	it('should produce a good xml', () => {
		return toContentTypes([])
			.then(xml => parseXml(xml))
			.then(result => {
				assert.ok(result);
				assert.ok(result.Types);
				assert.ok(result.Types.Default);
				assert.equal(result.Types.Default.length, 2);
				assert.ok(result.Types.Default[0].$);
				assert.equal(result.Types.Default[0].$.Extension, '.vsixmanifest');
				assert.equal(result.Types.Default[0].$.ContentType, 'text/xml');
				assert.ok(result.Types.Default[1].$);
				assert.equal(result.Types.Default[1].$.Extension, '.json');
				assert.equal(result.Types.Default[1].$.ContentType, 'application/json');
			});
	});
	
	it('should include extra extensions', () => {
		const files = [
			{ path: 'hello.txt' },
			{ path: 'hello.png' },
			{ path: 'hello.md' },
			{ path: 'hello' }
		];
		
		return toContentTypes(files)
			.then(xml => parseXml(xml))
			.then(result => {
				assert.ok(result.Types.Default);
				assert.ok(result.Types.Default.some(d => d.$.Extension === '.txt' && d.$.ContentType === 'text/plain'));
				assert.ok(result.Types.Default.some(d => d.$.Extension === '.png' && d.$.ContentType === 'image/png'));
				assert.ok(result.Types.Default.some(d => d.$.Extension === '.md' && d.$.ContentType === 'text/x-markdown'));
				assert.ok(!result.Types.Default.some(d => d.$.Extension === ''));
			});
	});
});