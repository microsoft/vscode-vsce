import {
	readManifest,
	collect,
	toContentTypes,
	ReadmeProcessor,
	read,
	processFiles,
	createDefaultProcessors,
	toVsixManifest,
	IFile,
	validateManifestForPackaging,
	IPackageOptions,
	ManifestProcessor,
	versionBump,
	VSIX,
	LicenseProcessor,
	printAndValidatePackagedFiles, pack
} from '../package';
import { ManifestPackage } from '../manifest';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import * as tmp from 'tmp';
import { spawnSync } from 'child_process';
import { XMLManifest, parseXmlManifest, parseContentTypes } from '../xml';
import { flatten, log } from '../util';
import { validatePublisher } from '../validation';
import * as jsonc from 'jsonc-parser';

// don't warn in tests
console.warn = () => null;

// accept read in tests
process.env['VSCE_TESTS'] = 'true';

async function throws(fn: () => Promise<any>): Promise<void> {
	let didThrow = false;

	try {
		await fn();
	} catch (err: any) {
		didThrow = true;
	}

	if (!didThrow) {
		throw new Error('Assertion failed');
	}
}

const fixture = (name: string) => path.join(path.dirname(path.dirname(__dirname)), 'src', 'test', 'fixtures', name);

function _toVsixManifest(manifest: ManifestPackage, files: IFile[], options: IPackageOptions = {}): Promise<string> {
	const processors = createDefaultProcessors(manifest, options);
	return processFiles(processors, files).then(() => {
		const assets = flatten(processors.map(p => p.assets));
		const tags = flatten(processors.map(p => p.tags)).join(',');
		const vsix = processors.reduce((r, p) => ({ ...r, ...p.vsix }), { assets, tags } as VSIX);

		return toVsixManifest(vsix);
	});
}

async function toXMLManifest(manifest: ManifestPackage, files: IFile[] = []): Promise<XMLManifest> {
	const raw = await _toVsixManifest(manifest, files);
	return parseXmlManifest(raw);
}

function assertProperty(manifest: XMLManifest, name: string, value: string): void {
	const property = manifest.PackageManifest.Metadata[0].Properties[0].Property.filter(p => p.$.Id === name);
	assert.strictEqual(property.length, 1, `Property '${name}' should exist`);

	const enableMarketplaceQnA = property[0].$.Value;
	assert.strictEqual(enableMarketplaceQnA, value, `Property '${name}' should have value '${value}'`);
}

function assertMissingProperty(manifest: XMLManifest, name: string): void {
	const property = manifest.PackageManifest.Metadata[0].Properties[0].Property.filter(p => p.$.Id === name);
	assert.strictEqual(property.length, 0, `Property '${name}' should not exist`);
}

function createManifest(extra: Partial<ManifestPackage> = {}): ManifestPackage {
	return {
		name: 'test',
		publisher: 'mocha',
		version: '0.0.1',
		description: 'test extension',
		engines: { vscode: '*' },
		...extra,
	};
}

const PROCESS_ERROR_MESSAGE = 'PROCESS ERROR';
async function testPrintAndValidatePackagedFiles(files: IFile[], cwd: string, manifest: ManifestPackage, options: IPackageOptions, errorExpected: boolean, warningExpected: boolean): Promise<void> {
	const originalLogError = log.error;
	const originalLogWarn = log.warn;
	const originalProcessExit = process.exit;
	const warns: string[] = [];
	const errors: string[] = [];
	let exited = false;
	let errorThrown: string | undefined;
	log.error = (message: string) => errors.push(message);
	log.warn = (message: string) => warns.push(message);
	process.exit = (() => { exited = true; throw Error(PROCESS_ERROR_MESSAGE); }) as () => never;

	try {
		await printAndValidatePackagedFiles(files, cwd, manifest, options);
	} catch (e: any) {
		if (e instanceof Error && e.message !== PROCESS_ERROR_MESSAGE) {
			errorThrown = e.message + '\n' + e.stack;
		}
	} finally {
		process.exit = originalProcessExit;
		log.error = originalLogError;
		log.warn = originalLogWarn;
	}

	// Validate that the correct number of errors and warnings were thrown
	const messages = [];

	if (errorExpected !== !!errors.length) {
		if (errors.length) {
			messages.push(...errors);
		} else {
			messages.push('Expected an error');
		}
	}

	if (warningExpected !== !!warns.length) {
		if (warns.length) {
			messages.push(...warns);
		} else {
			messages.push('Expected a warning');
		}
	}

	if (!errorExpected && exited) {
		messages.push('Process exited');
	}

	if (!errorExpected && !!errorThrown && !exited) {
		messages.push('Error thrown: ' + errorThrown);
	}

	if (messages.length) {
		throw new Error(messages.join('\n'));
	}
}

describe('collect', function () {
	this.timeout(60000);

	it('should catch all files', () => {
		const cwd = fixture('uuid');

		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd }))
			.then(files => {
				assert.strictEqual(files.length, 3);
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
			.then(manifest => collect(manifest, { cwd }))
			.then(files => {
				assert.strictEqual(files.length, 3);
			});
	});

	it('should ignore content of .vscodeignore', async () => {
		const cwd = fixture('vscodeignore');
		const manifest = await readManifest(cwd);
		const files = await collect(manifest, { cwd });
		const names = files.map(f => f.path).sort();

		assert.deepStrictEqual(names, [
			'[Content_Types].xml',
			'extension.vsixmanifest',
			'extension/foo/bar/hello.txt',
			'extension/package.json',
		]);
	});

	it('manifest.files', async () => {
		const cwd = fixture('manifestFiles');
		const manifest = await readManifest(cwd);
		const files = await collect(manifest, { cwd });
		const names = files.map(f => f.path).sort();

		await testPrintAndValidatePackagedFiles(files, cwd, manifest, {}, false, false);

		assert.deepStrictEqual(names, [
			'[Content_Types].xml',
			'extension.vsixmanifest',
			'extension/LICENSE.txt',
			'extension/foo/bar/hello.txt',
			'extension/foo2/bar2/include.me',
			'extension/foo3/bar3/hello.txt',
			'extension/fooInclude/included.txt',
			'extension/package.json',
			'extension/readme.md',
		]);
	});

	it('manifest.files unused-files-patterns check 1', async () => {
		const cwd = fixture('manifestFiles');
		const manifest = await readManifest(cwd);

		const manifestCopy = { ...manifest, files: [...manifest.files ?? [], 'extension/foo/bar/bye.txt'] };
		const files = await collect(manifestCopy, { cwd });

		await testPrintAndValidatePackagedFiles(files, cwd, manifestCopy, {}, true, false);
	});

	it('manifest.files unused-files-patterns check 2', async () => {
		const cwd = fixture('manifestFiles');
		const manifest = await readManifest(cwd);

		const manifestCopy = { ...manifest, files: [...manifest.files ?? [], 'extension/fo'] };
		const files = await collect(manifestCopy, { cwd });

		await testPrintAndValidatePackagedFiles(files, cwd, manifestCopy, {}, true, false);
	});

	it('manifest.files unused-files-patterns check 3', async () => {
		const cwd = fixture('manifestFiles');
		const manifest = await readManifest(cwd);

		const manifestCopy = { ...manifest, files: ['**'] };
		const files = await collect(manifestCopy, { cwd });

		await testPrintAndValidatePackagedFiles(files, cwd, manifestCopy, {}, false, false);
	});

	it('should ignore devDependencies', () => {
		const cwd = fixture('devDependencies');
		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd }))
			.then(files => {
				//   ..extension.vsixmanifest
				// [Content_Types].xml
				// extension/package.json
				// extension/node_modules/real/dependency.js
				// extension/node_modules/real/package.json
				// extension/node_modules/real2/dependency.js
				// extension/node_modules/real2/package.json
				// extension/node_modules/real_sub/dependency.js
				// extension/node_modules/real_sub/package.json
				// extension/node_modules/real/node_modules/real_sub/dependency.js
				// extension/node_modules/real/node_modules/real_sub/package.json
				assert.strictEqual(files.length, 11);
				assert.ok(files.some(f => /real\/dependency\.js/.test(f.path)));
				assert.ok(!files.some(f => /fake\/dependency\.js/.test(f.path)));
			});
	});

	it('should ignore **/.vsixmanifest', () => {
		const cwd = fixture('vsixmanifest');

		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd }))
			.then(files => {
				assert.strictEqual(files.filter(f => /\.vsixmanifest$/.test(f.path)).length, 1);
			});
	});

	it('should honor dependencyEntryPoints', () => {
		const cwd = fixture('packagedDependencies');

		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd, useYarn: true, dependencyEntryPoints: ['isexe'] }))
			.then(files => {
				let seenWhich: boolean = false;
				let seenIsexe: boolean = false;
				for (const file of files) {
					seenWhich = file.path.indexOf('/node_modules/which/') >= 0;
					seenIsexe = file.path.indexOf('/node_modules/isexe/') >= 0;
				}
				assert.strictEqual(seenWhich, false);
				assert.strictEqual(seenIsexe, true);
			});
	});

	it('should detect yarn', () => {
		const cwd = fixture('packagedDependencies');

		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd, dependencyEntryPoints: ['isexe'] }))
			.then(files => {
				let seenWhich: boolean = false;
				let seenIsexe: boolean = false;
				for (const file of files) {
					seenWhich = file.path.indexOf('/node_modules/which/') >= 0;
					seenIsexe = file.path.indexOf('/node_modules/isexe/') >= 0;
				}
				assert.strictEqual(seenWhich, false);
				assert.strictEqual(seenIsexe, true);
			});
	});

	it('should include all node_modules when dependencyEntryPoints is not defined', () => {
		const cwd = fixture('packagedDependencies');

		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd, useYarn: true }))
			.then(files => {
				let seenWhich: boolean = false;
				let seenIsexe: boolean = false;
				for (const file of files) {
					seenWhich = file.path.indexOf('/node_modules/which/') >= 0;
					seenIsexe = file.path.indexOf('/node_modules/isexe/') >= 0;
				}
				assert.strictEqual(seenWhich, true);
				assert.strictEqual(seenIsexe, true);
			});
	});

	it('should skip all node_modules when dependencyEntryPoints is []', () => {
		const cwd = fixture('packagedDependencies');

		return readManifest(cwd)
			.then(manifest => collect(manifest, { cwd, useYarn: true, dependencyEntryPoints: [] }))
			.then(files => {
				files.forEach(file => assert.ok(file.path.indexOf('/node_modules/which/') < 0, file.path));
			});
	});

	it('should skip all dependencies when using --no-dependencies', async () => {
		const cwd = fixture('devDependencies');
		const manifest = await readManifest(cwd);
		const files = await collect(manifest, { cwd, dependencies: false });

		assert.strictEqual(files.length, 3);

		for (const file of files) {
			assert.ok(!/\bnode_modules\b/i.test(file.path));
		}
	});

	it('should handle relative icon paths', async function () {
		const cwd = fixture('icon');
		const manifest = await readManifest(cwd);
		await collect(manifest, { cwd });
	});
});

describe('readManifest', () => {
	it('should patch NLS', async function () {
		const cwd = fixture('nls');
		const raw = JSON.parse(await fs.promises.readFile(path.join(cwd, 'package.json'), 'utf8'));
		const translations = jsonc.parse(await fs.promises.readFile(path.join(cwd, 'package.nls.json'), 'utf8'));
		const manifest = await readManifest(cwd);

		assert.strictEqual(manifest.name, raw.name);
		assert.strictEqual(manifest.description, translations['extension.description']);
		assert.strictEqual(manifest.contributes!.debuggers[0].label, translations['node.label']);
	});

	it('should not patch NLS if required', async function () {
		const cwd = fixture('nls');
		const raw = JSON.parse(await fs.promises.readFile(path.join(cwd, 'package.json'), 'utf8'));
		const translations = jsonc.parse(await fs.promises.readFile(path.join(cwd, 'package.nls.json'), 'utf8'));
		const manifest = await readManifest(cwd, false);

		assert.strictEqual(manifest.name, raw.name);
		assert.notStrictEqual(manifest.description, translations['extension.description']);
		assert.notStrictEqual(manifest.contributes!.debuggers[0].label, translations['node.label']);
	});
});

describe('validateManifest', () => {
	it('should catch missing fields', () => {
		assert.ok(validateManifestForPackaging({ publisher: 'demo', name: 'demo', version: '1.0.0', engines: { vscode: '0.10.1' } }));
		assert.throws(() => {
			validateManifestForPackaging({ publisher: 'demo', name: null!, version: '1.0.0', engines: { vscode: '0.10.1' } });
		});
		assert.throws(() => {
			validateManifestForPackaging({ publisher: 'demo', name: 'demo', version: null!, engines: { vscode: '0.10.1' } });
		});
		assert.throws(() => {
			validateManifestForPackaging({ publisher: 'demo', name: 'demo', version: '1.0', engines: { vscode: '0.10.1' } });
		});
		assert.throws(() => {
			validateManifestForPackaging({ publisher: 'demo', name: 'demo', version: '1.0.0', engines: null! });
		});
		assert.throws(() => {
			validateManifestForPackaging({ publisher: 'demo', name: 'demo', version: '1.0.0', engines: { vscode: null } as any });
		});
		validatePublisher('demo');
		assert.throws(() => validatePublisher(undefined));
		assert.ok(validateManifestForPackaging({ publisher: undefined, name: 'demo', version: '1.0.0', engines: { vscode: '0.10.1' } }));
	});

	it('should prevent SVG icons', () => {
		assert.ok(validateManifestForPackaging(createManifest({ icon: 'icon.png' })));
		assert.throws(() => {
			validateManifestForPackaging(createManifest({ icon: 'icon.svg' }));
		});
	});

	it('should prevent badges from non HTTPS sources', () => {
		assert.throws(() => {
			validateManifestForPackaging(
				createManifest({ badges: [{ url: 'relative.png', href: 'http://badgeurl', description: 'this is a badge' }] })
			);
		});
		assert.throws(() => {
			validateManifestForPackaging(
				createManifest({ badges: [{ url: 'relative.svg', href: 'http://badgeurl', description: 'this is a badge' }] })
			);
		});
		assert.throws(() => {
			validateManifestForPackaging(
				createManifest({
					badges: [{ url: 'http://badgeurl.png', href: 'http://badgeurl', description: 'this is a badge' }],
				})
			);
		});
	});

	it('should allow non SVG badges', () => {
		assert.ok(
			validateManifestForPackaging(
				createManifest({
					badges: [{ url: 'https://host/badge.png', href: 'http://badgeurl', description: 'this is a badge' }],
				})
			)
		);
	});

	it('should allow SVG badges from trusted sources', () => {
		assert.ok(
			validateManifestForPackaging(
				createManifest({
					badges: [{ url: 'https://gemnasium.com/foo.svg', href: 'http://badgeurl', description: 'this is a badge' }],
				})
			)
		);
	});

	it('should prevent SVG badges from non trusted sources', () => {
		assert.throws(() => {
			assert.ok(
				validateManifestForPackaging(
					createManifest({
						badges: [{ url: 'https://github.com/foo.svg', href: 'http://badgeurl', description: 'this is a badge' }],
					})
				)
			);
		});
		assert.throws(() => {
			assert.ok(
				validateManifestForPackaging(
					createManifest({
						badges: [
							{
								url: 'https://dev.w3.org/SVG/tools/svgweb/samples/svg-files/410.sv%67',
								href: 'http://badgeurl',
								description: 'this is a badge',
							},
						],
					})
				)
			);
		});
	});

	it('should validate activationEvents against main and browser', () => {
		assert.throws(() => validateManifestForPackaging(createManifest({ activationEvents: ['any'] })));
		assert.throws(() => validateManifestForPackaging(createManifest({ main: 'main.js' })));
		assert.throws(() => validateManifestForPackaging(createManifest({ browser: 'browser.js' })));
		assert.throws(() => validateManifestForPackaging(createManifest({ main: 'main.js', browser: 'browser.js' })));
		validateManifestForPackaging(createManifest({ activationEvents: ['any'], main: 'main.js' }));
		validateManifestForPackaging(createManifest({ activationEvents: ['any'], browser: 'browser.js' }));
		validateManifestForPackaging(createManifest({ activationEvents: ['any'], main: 'main.js', browser: 'browser.js' }));
	});

	it('should validate extensionKind', () => {
		assert.throws(() => validateManifestForPackaging(createManifest({ extensionKind: ['web'] })));
		assert.throws(() => validateManifestForPackaging(createManifest({ extensionKind: 'web' })));
		assert.throws(() => validateManifestForPackaging(createManifest({ extensionKind: ['workspace', 'ui', 'web'] })));
		assert.throws(() => validateManifestForPackaging(createManifest({ extensionKind: ['workspace', 'web'] })));
		assert.throws(() => validateManifestForPackaging(createManifest({ extensionKind: ['ui', 'web'] })));
		assert.throws(() => validateManifestForPackaging(createManifest(<any>{ extensionKind: ['any'] })));
		validateManifestForPackaging(createManifest({ extensionKind: 'ui' }));
		validateManifestForPackaging(createManifest({ extensionKind: ['ui'] }));
		validateManifestForPackaging(createManifest({ extensionKind: 'workspace' }));
		validateManifestForPackaging(createManifest({ extensionKind: ['workspace'] }));
		validateManifestForPackaging(createManifest({ extensionKind: ['ui', 'workspace'] }));
		validateManifestForPackaging(createManifest({ extensionKind: ['workspace', 'ui'] }));
	});

	it('should validate sponsor', () => {
		assert.throws(() => validateManifestForPackaging(createManifest({ sponsor: { url: 'hello' } })));
		assert.throws(() => validateManifestForPackaging(createManifest({ sponsor: { url: 'www.foo.com' } })));
		validateManifestForPackaging(createManifest({ sponsor: { url: 'https://foo.bar' } }));
		validateManifestForPackaging(createManifest({ sponsor: { url: 'http://www.foo.com' } }));
	});

	it('should validate pricing', () => {
		assert.throws(() => validateManifestForPackaging(createManifest({ pricing: 'Paid' })));
		validateManifestForPackaging(createManifest({ pricing: 'Trial' }));
		validateManifestForPackaging(createManifest({ pricing: 'Free' }));
		validateManifestForPackaging(createManifest());
	});

	it('should allow implicit activation events', () => {
		validateManifestForPackaging(
			createManifest({
				engines: { vscode: '>=1.74.0' },
				main: 'main.js',
				contributes: {
					commands: [
						{
							command: 'extension.helloWorld',
							title: 'Hello World',
						},
					],
				},
			})
		);

		validateManifestForPackaging(
			createManifest({
				engines: { vscode: '*' },
				main: 'main.js',
				contributes: {
					commands: [
						{
							command: 'extension.helloWorld',
							title: 'Hello World',
						},
					],
				},
			})
		);

		validateManifestForPackaging(
			createManifest({
				engines: { vscode: '>=1.74.0' },
				contributes: {
					languages: [
						{
							id: 'typescript',
						}
					]
				}
			})
		);

		assert.throws(() =>
			validateManifestForPackaging(
				createManifest({
					engines: { vscode: '>=1.73.3' },
					main: 'main.js',
				})
			)
		);

		assert.throws(() =>
			validateManifestForPackaging(
				createManifest({
					engines: { vscode: '>=1.73.3' },
					activationEvents: ['*'],
				})
			)
		);

		assert.throws(() =>
			validateManifestForPackaging(
				createManifest({
					engines: { vscode: '>=1.73.3' },
					main: 'main.js',
					contributes: {
						commands: [
							{
								command: 'extension.helloWorld',
								title: 'Hello World',
							},
						],
					},
				})
			)
		);
	});
});

describe('toVsixManifest', () => {
	it('should produce a good xml', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				assert.ok(result);
				assert.ok(result.PackageManifest);
				assert.ok(result.PackageManifest.$);
				assert.strictEqual(result.PackageManifest.$.Version, '2.0.0');
				assert.strictEqual(result.PackageManifest.$.xmlns, 'http://schemas.microsoft.com/developer/vsx-schema/2011');
				assert.strictEqual(
					result.PackageManifest.$['xmlns:d'],
					'http://schemas.microsoft.com/developer/vsx-schema-design/2011'
				);
				assert.ok(result.PackageManifest.Metadata);
				assert.strictEqual(result.PackageManifest.Metadata.length, 1);
				assert.strictEqual(result.PackageManifest.Metadata[0].Description[0]._, 'test extension');
				assert.strictEqual(result.PackageManifest.Metadata[0].DisplayName[0], 'test');
				assert.strictEqual(result.PackageManifest.Metadata[0].Identity[0].$.Id, 'test');
				assert.strictEqual(result.PackageManifest.Metadata[0].Identity[0].$.Version, '0.0.1');
				assert.strictEqual(result.PackageManifest.Metadata[0].Identity[0].$.Publisher, 'mocha');
				assert.deepEqual(result.PackageManifest.Metadata[0].Tags, ['__web_extension']);
				assert.deepEqual(result.PackageManifest.Metadata[0].GalleryFlags, ['Public']);
				assert.strictEqual(result.PackageManifest.Installation.length, 1);
				assert.strictEqual(result.PackageManifest.Installation[0].InstallationTarget.length, 1);
				assert.strictEqual(
					result.PackageManifest.Installation[0].InstallationTarget[0].$.Id,
					'Microsoft.VisualStudio.Code'
				);
				assert.deepEqual(result.PackageManifest.Dependencies, ['']);
				assert.strictEqual(result.PackageManifest.Assets.length, 1);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 1);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[0].$.Type, 'Microsoft.VisualStudio.Code.Manifest');
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[0].$.Path, 'extension/package.json');
			});
	});

	it('should escape special characters', () => {
		const specialCharacters = '\'"<>&`';

		const name = `name${specialCharacters}`;
		const publisher = `publisher${specialCharacters}`;
		const version = `version${specialCharacters}`;
		const description = `description${specialCharacters}`;

		const manifest = {
			name,
			publisher,
			version,
			description,
			engines: Object.create(null),
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Metadata[0].Identity[0].$.Version, version);
				assert.strictEqual(result.PackageManifest.Metadata[0].Identity[0].$.Publisher, publisher);
				assert.strictEqual(result.PackageManifest.Metadata[0].DisplayName[0], name);
				assert.strictEqual(result.PackageManifest.Metadata[0].Description[0]._, description);
			});
	});

	it('should treat README.md as asset', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/readme.md', contents: Buffer.from('') }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.Details'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/readme.md');
			});
	});

	it('should handle readmePath', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/foo/readme-foo.md', contents: Buffer.from('') }];

		return _toVsixManifest(manifest, files, { readmePath: 'foo/readme-foo.md' })
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.Details'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/readme.md');
			});
	});

	it('should treat CHANGELOG.md as asset', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/changelog.md', contents: Buffer.from('') }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.Changelog'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/changelog.md');
			});
	});

	it('should handle changelogPath', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/foo/changelog-foo.md', contents: Buffer.from('') }];

		return _toVsixManifest(manifest, files, { changelogPath: 'foo/changelog-foo.md' })
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.Changelog'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/changelog.md');
			});
	});

	it('should respect display name', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			displayName: 'Test Extension',
			engines: Object.create(null),
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Metadata[0].Identity[0].$.Id, 'test');
				assert.strictEqual(result.PackageManifest.Metadata[0].DisplayName[0], 'Test Extension');
			});
	});

	it('should treat any license file as asset', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			license: 'SEE LICENSE IN thelicense.md',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/thelicense.md', contents: '' }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.License'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/thelicense.md');
			});
	});

	it('should add a license metadata tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			license: 'SEE LICENSE IN thelicense.md',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/thelicense.md', contents: '' }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].License);
				assert.strictEqual(result.PackageManifest.Metadata[0].License.length, 1);
				assert.strictEqual(result.PackageManifest.Metadata[0].License[0], 'extension/thelicense.md');
			});
	});

	it('should automatically detect license files', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/LICENSE.md', contents: '' }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].License);
				assert.strictEqual(result.PackageManifest.Metadata[0].License.length, 1);
				assert.strictEqual(result.PackageManifest.Metadata[0].License[0], 'extension/LICENSE.md');
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.License'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/LICENSE.md');
			});
	});

	it('should automatically detect misspelled license files', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [{ path: 'extension/LICENCE.md', contents: '' }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].License);
				assert.strictEqual(result.PackageManifest.Metadata[0].License.length, 1);
				assert.strictEqual(result.PackageManifest.Metadata[0].License[0], 'extension/LICENCE.md');
				assert.strictEqual(result.PackageManifest.Assets[0].Asset.length, 2);
				assert.strictEqual(
					result.PackageManifest.Assets[0].Asset[1].$.Type,
					'Microsoft.VisualStudio.Services.Content.License'
				);
				assert.strictEqual(result.PackageManifest.Assets[0].Asset[1].$.Path, 'extension/LICENCE.md');
			});
	});

	it('should add an icon metadata tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			icon: 'fake.png',
			license: 'SEE LICENSE IN thelicense.md',
		};

		const files = [
			{ path: 'extension/fake.png', contents: '' },
			{ path: 'extension/thelicense.md', contents: '' },
		];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].Icon);
				assert.strictEqual(result.PackageManifest.Metadata[0].Icon.length, 1);
				assert.strictEqual(result.PackageManifest.Metadata[0].Icon[0], 'extension/fake.png');
				assert.strictEqual(result.PackageManifest.Metadata[0].License[0], 'extension/thelicense.md');
			});
	});

	it('should add an icon asset', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			icon: 'fake.png',
		};

		const files = [{ path: 'extension/fake.png', contents: '' }];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.ok(
					result.PackageManifest.Assets[0].Asset.some(
						d => d.$.Type === 'Microsoft.VisualStudio.Services.Icons.Default' && d.$.Path === 'extension/fake.png'
					)
				);
			});
	});

	it('should add asset with win path', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			icon: 'fake.png',
			license: 'SEE LICENSE IN thelicense.md',
		};

		const files = [
			{ path: 'extension\\fake.png', contents: '' },
			{ path: 'extension\\thelicense.md', contents: '' },
		];

		return _toVsixManifest(manifest, files)
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.ok(result.PackageManifest.Metadata[0].Icon);
				assert.strictEqual(result.PackageManifest.Metadata[0].Icon.length, 1);
				assert.strictEqual(result.PackageManifest.Metadata[0].Icon[0], 'extension/fake.png');
				assert.strictEqual(result.PackageManifest.Metadata[0].License[0], 'extension/thelicense.md');
			});
	});

	it('should understand gallery color and theme', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			galleryBanner: {
				color: '#5c2d91',
				theme: 'dark',
			},
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property.map(p => p.$);
				assert.ok(
					properties.some(p => p.Id === 'Microsoft.VisualStudio.Services.Branding.Color' && p.Value === '#5c2d91')
				);
				assert.ok(
					properties.some(p => p.Id === 'Microsoft.VisualStudio.Services.Branding.Theme' && p.Value === 'dark')
				);
			});
	});

	it('should understand all link types', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: {
				type: 'git',
				url: 'https://server.com/Microsoft/vscode-spell-check.git',
			},
			bugs: {
				url: 'https://server.com/Microsoft/vscode-spell-check/issues',
			},
			homepage: 'https://server.com/Microsoft/vscode-spell-check',
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property.map(p => p.$);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Source' &&
							p.Value === 'https://server.com/Microsoft/vscode-spell-check.git'
					)
				);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Getstarted' &&
							p.Value === 'https://server.com/Microsoft/vscode-spell-check.git'
					)
				);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Repository' &&
							p.Value === 'https://server.com/Microsoft/vscode-spell-check.git'
					)
				);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Support' &&
							p.Value === 'https://server.com/Microsoft/vscode-spell-check/issues'
					)
				);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Learn' &&
							p.Value === 'https://server.com/Microsoft/vscode-spell-check'
					)
				);
			});
	});

	it('should detect github repositories', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: {
				type: 'git',
				url: 'https://github.com/Microsoft/vscode-spell-check.git',
			},
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property.map(p => p.$);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.GitHub' &&
							p.Value === 'https://github.com/Microsoft/vscode-spell-check.git'
					)
				);
				assert.ok(properties.every(p => p.Id !== 'Microsoft.VisualStudio.Services.Links.Repository'));
			});
	});

	it('should detect short gitlab repositories', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'gitlab:Microsoft/vscode-spell-check',
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property.map(p => p.$);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Repository' &&
							p.Value === 'https://gitlab.com/Microsoft/vscode-spell-check.git'
					)
				);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Support' &&
							p.Value === 'https://gitlab.com/Microsoft/vscode-spell-check/issues'
					)
				);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.Learn' &&
							p.Value === 'https://gitlab.com/Microsoft/vscode-spell-check#readme'
					)
				);
			});
	});

	it('should detect short github repositories', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'Microsoft/vscode-spell-check',
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property.map(p => p.$);
				assert.ok(
					properties.some(
						p =>
							p.Id === 'Microsoft.VisualStudio.Services.Links.GitHub' &&
							p.Value === 'https://github.com/Microsoft/vscode-spell-check.git'
					)
				);
				assert.ok(properties.every(p => p.Id !== 'Microsoft.VisualStudio.Services.Links.Repository'));
			});
	});

	it('should understand categories', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			categories: ['hello', 'world'],
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const categories = result.PackageManifest.Metadata[0].Categories[0].split(',');
				assert.ok(categories.some(c => c === 'hello'));
				assert.ok(categories.some(c => c === 'world'));
			});
	});

	it('should respect preview flag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			preview: true,
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				assert.deepEqual(result.PackageManifest.Metadata[0].GalleryFlags, ['Public Preview']);
			});
	});

	it('should automatically add theme tag for color themes', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				themes: [{ label: 'monokai', uiTheme: 'vs', path: 'monokai.tmTheme' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'theme'));
			});
	});

	it('should not automatically add theme tag when themes are empty', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				themes: [],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => assert.deepEqual(result.PackageManifest.Metadata[0].Tags[0], '__web_extension'));
	});

	it('should automatically add color-theme tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				themes: [{ label: 'monokai', uiTheme: 'vs', path: 'monokai.tmTheme' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'color-theme'));
			});
	});

	it('should automatically add theme tag for icon themes', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				iconThemes: [{ id: 'fakeicons', label: 'fakeicons', path: 'fake.icons' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'theme'));
			});
	});

	it('should automatically add icon-theme tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				iconThemes: [{ id: 'fakeicons', label: 'fakeicons', path: 'fake.icons' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'icon-theme'));
			});
	});

	it('should automatically add product-icon-theme tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				productIconThemes: [{ id: 'fakeicons', label: 'fakeicons', path: 'fake.icons' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'product-icon-theme'));
			});
	});

	it('should automatically add remote-menu tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				menus: {
					'statusBar/remoteIndicator': [
						{
							command: 'remote-wsl.newWindow',
						},
					],
				},
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'remote-menu'));
			});
	});

	it('should automatically add language tag with activationEvent', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			activationEvents: ['onLanguage:go'],
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => assert.deepEqual(result.PackageManifest.Metadata[0].Tags[0], 'go,__web_extension'));
	});

	it('should automatically add language tag with language contribution', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				languages: [{ id: 'go' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => assert.deepEqual(result.PackageManifest.Metadata[0].Tags[0], 'go,__web_extension'));
	});

	it('should automatically add snippets tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				snippets: [{ language: 'go', path: 'gosnippets.json' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => assert.deepEqual(result.PackageManifest.Metadata[0].Tags[0], 'snippet,__web_extension'));
	});

	it('should automatically add chatParticipant and github-copilot tag', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				chatParticipants: [{ name: 'test', id: 'test' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => assert.deepEqual(result.PackageManifest.Metadata[0].Tags[0], 'chat-participant,github-copilot,__web_extension'));
	});

	it('should remove duplicate tags', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			keywords: ['theme', 'theme'],
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => assert.deepEqual(result.PackageManifest.Metadata[0].Tags[0], 'theme,__web_extension'));
	});

	it('should detect keybindings', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				keybindings: [{ command: 'hello', key: 'ctrl+f1' }],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'keybindings'));
			});
	});

	it('should detect debuggers', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				debuggers: [
					{
						type: 'node',
						label: 'Node Debug',
						program: './out/node/nodeDebug.js',
						runtime: 'node',
						enableBreakpointsFor: { languageIds: ['javascript', 'javascriptreact'] },
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'debuggers'));
			});
	});

	it('should detect json validation rules', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				jsonValidation: [
					{
						fileMatch: '.jshintrc',
						url: 'http://json.schemastore.org/jshintrc',
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'json'));
			});
	});

	it('should detect keywords in description', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			description: 'This C++ extension likes combines ftp with javascript',
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(
					tags.some(tag => tag === 'c++'),
					'detect c++'
				);
				assert.ok(
					tags.some(tag => tag === 'ftp'),
					'detect ftp'
				);
				assert.ok(
					tags.some(tag => tag === 'javascript'),
					'detect javascript'
				);
				assert.ok(!tags.includes('java'), "don't detect java");
			});
	});

	it('should detect language grammars', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				grammars: [
					{
						language: 'shellscript',
						scopeName: 'source.shell',
						path: './syntaxes/Shell-Unix-Bash.tmLanguage',
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'shellscript'));
			});
	});

	it('should detect language aliases', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				languages: [
					{
						id: 'go',
						aliases: ['golang', 'google-go'],
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'go'));
				assert.ok(tags.some(tag => tag === 'golang'));
				assert.ok(tags.some(tag => tag === 'google-go'));
			});
	});

	it('should detect localization contributions', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				localizations: [
					{
						languageId: 'de',
						translations: [
							{ id: 'vscode', path: 'fake.json' },
							{ id: 'vscode.go', path: 'what.json' },
						],
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === 'lp-de'));
				assert.ok(tags.some(tag => tag === '__lp_vscode'));
				assert.ok(tags.some(tag => tag === '__lp-de_vscode'));
				assert.ok(tags.some(tag => tag === '__lp_vscode.go'));
				assert.ok(tags.some(tag => tag === '__lp-de_vscode.go'));
			});
	});

	it('should expose localization contributions as assets', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				localizations: [
					{
						languageId: 'de',
						languageName: 'German',
						translations: [
							{ id: 'vscode', path: 'de.json' },
							{ id: 'vscode.go', path: 'what.json' },
						],
					},
					{
						languageId: 'pt',
						languageName: 'Portuguese',
						localizedLanguageName: 'Português',
						translations: [{ id: 'vscode', path: './translations/pt.json' }],
					},
				],
			},
		};

		const files = [
			{ path: 'extension/de.json', contents: Buffer.from('') },
			{ path: 'extension/translations/pt.json', contents: Buffer.from('') },
		];

		return _toVsixManifest(manifest, files)
			.then(parseXmlManifest)
			.then(result => {
				const assets = result.PackageManifest.Assets[0].Asset;
				assert.ok(
					assets.some(
						asset =>
							asset.$.Type === 'Microsoft.VisualStudio.Code.Translation.DE' && asset.$.Path === 'extension/de.json'
					)
				);
				assert.ok(
					assets.some(
						asset =>
							asset.$.Type === 'Microsoft.VisualStudio.Code.Translation.PT' &&
							asset.$.Path === 'extension/translations/pt.json'
					)
				);

				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				const localizedLangProp = properties.filter(p => p.$.Id === 'Microsoft.VisualStudio.Code.LocalizedLanguages');
				assert.strictEqual(localizedLangProp.length, 1);

				const localizedLangs = localizedLangProp[0].$.Value.split(',');
				assert.strictEqual(localizedLangs.length, 2);
				assert.strictEqual(localizedLangs[0], 'German');
				assert.strictEqual(localizedLangs[1], 'Português');
			});
	});

	it('should detect language extensions', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				languages: [
					{
						id: 'go',
						extensions: ['go', 'golang'],
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === '__ext_go'));
				assert.ok(tags.some(tag => tag === '__ext_golang'));
			});
	});

	it('should detect and sanitize language extensions', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				languages: [
					{
						id: 'go',
						extensions: ['.go'],
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				assert.ok(tags.some(tag => tag === '__ext_go'));
			});
	});

	it('should understand badges', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			badges: [
				{ url: 'http://badgeurl.png', href: 'http://badgeurl', description: 'this is a badge' },
				{ url: 'http://anotherbadgeurl.png', href: 'http://anotherbadgeurl', description: 'this is another badge' },
			],
		};

		return _toVsixManifest(manifest, [])
			.then(xml => parseXmlManifest(xml))
			.then(result => {
				const badges = result.PackageManifest.Metadata[0].Badges[0].Badge;
				assert.strictEqual(badges.length, 2);
				assert.strictEqual(badges[0].$.Link, 'http://badgeurl');
				assert.strictEqual(badges[0].$.ImgUri, 'http://badgeurl.png');
				assert.strictEqual(badges[0].$.Description, 'this is a badge');
				assert.strictEqual(badges[1].$.Link, 'http://anotherbadgeurl');
				assert.strictEqual(badges[1].$.ImgUri, 'http://anotherbadgeurl.png');
				assert.strictEqual(badges[1].$.Description, 'this is another badge');
			});
	});

	it('should not have empty keywords #114', () => {
		const manifest: ManifestPackage = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			contributes: {
				grammars: [
					{
						language: 'javascript',
						scopeName: 'source.js.jsx',
						path: './syntaxes/Babel Language.json',
					},
					{
						language: 'regex',
						scopeName: 'source.regexp.babel',
						path: './syntaxes/Babel Regex.json',
					},
				],
			},
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const tags = result.PackageManifest.Metadata[0].Tags[0].split(',') as string[];
				tags.forEach(tag => assert.ok(tag, `Found empty tag '${tag}'.`));
			});
	});

	it('should use engine as a version property', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: { vscode: '^1.0.0' } as any,
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				const engineProperties = properties.filter(p => p.$.Id === 'Microsoft.VisualStudio.Code.Engine');
				assert.strictEqual(engineProperties.length, 1);

				const engine = engineProperties[0].$.Value;
				assert.strictEqual(engine, '^1.0.0');
			});
	});

	it('should use github markdown by default', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				assert.ok(
					properties.some(
						p => p.$.Id === 'Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown' && p.$.Value === 'true'
					)
				);
			});
	});

	it('should understand the markdown property', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			markdown: 'standard' as 'standard',
			engines: Object.create(null),
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				assert.ok(
					properties.some(
						p => p.$.Id === 'Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown' && p.$.Value === 'false'
					)
				);
			});
	});

	it('should ignore unknown markdown properties', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			markdown: 'wow' as any,
			engines: Object.create(null),
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				assert.ok(
					properties.some(
						p => p.$.Id === 'Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown' && p.$.Value === 'true'
					)
				);
			});
	});

	it('should add extension dependencies property', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			extensionDependencies: ['foo.bar', 'foo.bar', 'monkey.hello'],
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				const dependenciesProp = properties.filter(p => p.$.Id === 'Microsoft.VisualStudio.Code.ExtensionDependencies');
				assert.strictEqual(dependenciesProp.length, 1);

				const dependencies = dependenciesProp[0].$.Value.split(',');
				assert.strictEqual(dependencies.length, 2);
				assert.ok(dependencies.some(d => d === 'foo.bar'));
				assert.ok(dependencies.some(d => d === 'monkey.hello'));
			});
	});

	it('should error with files with same case insensitive name', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const files = [
			{ path: 'extension/file.txt', contents: '' },
			{ path: 'extension/FILE.txt', contents: '' },
		];

		try {
			await _toVsixManifest(manifest, files);
		} catch (err: any) {
			assert.ok(/have the same case insensitive path/i.test(err.message));
			return;
		}

		throw new Error('Should not reach here');
	});

	it('should automatically add web tag for web extensions', async () => {
		const manifest = createManifest({ browser: 'browser.js' });
		const files = [{ path: 'extension/browser.js', contents: Buffer.from('') }];

		const vsixManifest = await _toVsixManifest(manifest, files);
		const result = await parseXmlManifest(vsixManifest);

		assert.strictEqual(result.PackageManifest.Metadata[0].Tags[0], '__web_extension');
	});

	it('should expose extension kind properties when provided', async () => {
		const manifest = createManifest({
			extensionKind: ['ui', 'workspace', 'web'],
		});
		const files = [{ path: 'extension/main.js', contents: Buffer.from('') }];

		const vsixManifest = await _toVsixManifest(manifest, files);
		const result = await parseXmlManifest(vsixManifest);
		const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
		const extensionKindProps = properties.filter(p => p.$.Id === 'Microsoft.VisualStudio.Code.ExtensionKind');
		assert.strictEqual(extensionKindProps[0].$.Value, ['ui', 'workspace', 'web'].join(','));
	});

	it('should expose extension kind properties when derived', async () => {
		const manifest = createManifest({
			main: 'main.js',
		});
		const files = [{ path: 'extension/main.js', contents: Buffer.from('') }];

		const vsixManifest = await _toVsixManifest(manifest, files);
		const result = await parseXmlManifest(vsixManifest);
		const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
		const extensionKindProps = properties.filter(p => p.$.Id === 'Microsoft.VisualStudio.Code.ExtensionKind');
		assert.strictEqual(extensionKindProps[0].$.Value, 'workspace');
	});

	it('should not have target platform by default', async () => {
		const manifest = createManifest();
		const raw = await _toVsixManifest(manifest, []);
		const dom = await parseXmlManifest(raw);

		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Id, 'test');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Version, '0.0.1');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Publisher, 'mocha');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.TargetPlatform, undefined);
	});

	it('should set the right target platform by default', async () => {
		const manifest = createManifest();
		const raw = await _toVsixManifest(manifest, [], { target: 'win32-x64' });
		const dom = await parseXmlManifest(raw);

		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Id, 'test');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Version, '0.0.1');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Publisher, 'mocha');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.TargetPlatform, 'win32-x64');
	});

	it('should set the target platform when engine is set to insider', async () => {
		const manifest = createManifest({ engines: { vscode: '>=1.62.0-insider' } });
		const raw = await _toVsixManifest(manifest, [], { target: 'win32-x64' });
		const dom = await parseXmlManifest(raw);

		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Id, 'test');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Version, '0.0.1');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.Publisher, 'mocha');
		assert.strictEqual(dom.PackageManifest.Metadata[0].Identity[0].$.TargetPlatform, 'win32-x64');
	});

	it('should fail when target is invalid', async () => {
		const manifest = createManifest();

		try {
			await _toVsixManifest(manifest, [], { target: 'what' });
		} catch (err: any) {
			return assert.ok(/is not a valid VS Code target/i.test(err.message));
		}

		throw new Error('Should not reach here');
	});

	it('should throw when using an invalid target platform', async () => {
		const manifest = createManifest();

		try {
			await _toVsixManifest(manifest, [], { target: 'linux-ia32' });
		} catch (err: any) {
			return assert.ok(/not a valid VS Code target/.test(err.message));
		}

		throw new Error('Should not reach here');
	});

	it('should throw when targeting an old VS Code version with platform specific', async () => {
		const manifest = createManifest({ engines: { vscode: '>=1.60.0' } });

		try {
			await _toVsixManifest(manifest, [], { target: 'linux-ia32' });
		} catch (err: any) {
			return assert.ok(/>=1.61/.test(err.message));
		}

		throw new Error('Should not reach here');
	});

	it('should add prerelease property when --pre-release flag is passed', async () => {
		const manifest = createManifest({ engines: { vscode: '>=1.63.0' } });

		const raw = await _toVsixManifest(manifest, [], { preRelease: true });
		const xmlManifest = await parseXmlManifest(raw);

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Code.PreRelease', 'true');
	});

	it('should add executes code property when main is passed', async () => {
		const manifest = createManifest({ main: 'main.js' });
		const files = [{ path: 'extension/main.js', contents: Buffer.from('') }];

		const raw = await _toVsixManifest(manifest, files);
		const xmlManifest = await parseXmlManifest(raw);

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Code.ExecutesCode', 'true');
	});

	it('should add executes code property when browser is passed', async () => {
		const manifest = createManifest({ browser: 'browser.js' });
		const files = [{ path: 'extension/browser.js', contents: Buffer.from('') }];

		const raw = await _toVsixManifest(manifest, files);
		const xmlManifest = await parseXmlManifest(raw);

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Code.ExecutesCode', 'true');
	});

	it('should not add executes code property when neither main nor browser is passed', async () => {
		const manifest = createManifest();

		const raw = await _toVsixManifest(manifest, []);
		const xmlManifest = await parseXmlManifest(raw);

		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Code.ExecutesCode');
	});

	it('should add sponsor link property', () => {
		const sponsor = { url: 'https://foo.bar' };
		const manifest: ManifestPackage = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			sponsor,
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				const sponsorLinkProp = properties.find(p => p.$.Id === 'Microsoft.VisualStudio.Code.SponsorLink');
				assert.strictEqual(sponsorLinkProp?.$.Value, sponsor.url);
			});
	});

	it('should automatically add sponsor tag for extension with sponsor link', async () => {
		const manifest = createManifest({ sponsor: { url: 'https://foo.bar' } });
		const vsixManifest = await _toVsixManifest(manifest, []);
		const result = await parseXmlManifest(vsixManifest);

		assert.ok(result.PackageManifest.Metadata[0].Tags[0].split(',').includes('__sponsor_extension'));
	});

	it('should add prerelease property when --pre-release flag is passed when engine property is for insiders', async () => {
		const manifest = createManifest({ engines: { vscode: '>=1.64.0-insider' } });

		const raw = await _toVsixManifest(manifest, [], { preRelease: true });
		const xmlManifest = await parseXmlManifest(raw);

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Code.PreRelease', 'true');
	});

	it('should not add prerelease property when --pre-release flag is not passed', async () => {
		const manifest = createManifest({ engines: { vscode: '>=1.64.0' } });

		const raw = await _toVsixManifest(manifest, []);
		const xmlManifest = await parseXmlManifest(raw);

		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Code.PreRelease');
	});

	it('should throw when targeting an old VS Code version with --pre-release', async () => {
		const manifest = createManifest({ engines: { vscode: '>=1.62.0' } });

		try {
			await _toVsixManifest(manifest, [], { preRelease: true });
		} catch (err: any) {
			return assert.ok(/>=1.63/.test(err.message));
		}

		throw new Error('Should not reach here');
	});

	it('should identify trial version of an extension', async () => {
		const manifest = createManifest({ pricing: 'Trial' });
		var raw = await _toVsixManifest(manifest, []);
		const xmlManifest = await parseXmlManifest(raw);
		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Services.Content.Pricing', 'Trial');
	});

	it('should expose enabledApiProposals as properties', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			enabledApiProposals: [
				'foo',
				'bar@2'
			],
		};

		return _toVsixManifest(manifest, [])
			.then(parseXmlManifest)
			.then(result => {
				const properties = result.PackageManifest.Metadata[0].Properties[0].Property;
				const enabledApiProposalsProp = properties.filter(p => p.$.Id === 'Microsoft.VisualStudio.Code.EnabledApiProposals');
				assert.strictEqual(enabledApiProposalsProp.length, 1);

				const enabledApiProposals = enabledApiProposalsProp[0].$.Value.split(',');
				assert.strictEqual(enabledApiProposals.length, 2);
				assert.strictEqual(enabledApiProposals[0], 'foo');
				assert.strictEqual(enabledApiProposals[1], 'bar@2');
			});
	});
});

describe('qna', () => {
	it('should use marketplace qna by default', async () => {
		const xmlManifest = await toXMLManifest({
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
		});

		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.EnableMarketplaceQnA');
		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.CustomerQnALink');
	});

	it('should not use marketplace in a github repo, without specifying it', async () => {
		const xmlManifest = await toXMLManifest({
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		});

		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.EnableMarketplaceQnA');
		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.CustomerQnALink');
	});

	it('should use marketplace in a github repo, when specifying it', async () => {
		const xmlManifest = await toXMLManifest({
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
			qna: 'marketplace',
		});

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Services.EnableMarketplaceQnA', 'true');
		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.CustomerQnALink');
	});

	it('should handle qna=marketplace', async () => {
		const xmlManifest = await toXMLManifest({
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			qna: 'marketplace',
		});

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Services.EnableMarketplaceQnA', 'true');
		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.CustomerQnALink');
	});

	it('should handle qna=false', async () => {
		const xmlManifest = await toXMLManifest({
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			qna: false,
		});

		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Services.EnableMarketplaceQnA', 'false');
		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.CustomerQnALink');
	});

	it('should handle custom qna', async () => {
		const xmlManifest = await toXMLManifest({
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			qna: 'http://myqna',
		});

		assertMissingProperty(xmlManifest, 'Microsoft.VisualStudio.Services.EnableMarketplaceQnA');
		assertProperty(xmlManifest, 'Microsoft.VisualStudio.Services.CustomerQnALink', 'http://myqna');
	});
});

describe('toContentTypes', () => {
	it('should produce a good xml', () => {
		return toContentTypes([])
			.then(xml => parseContentTypes(xml))
			.then(result => {
				assert.ok(result);
				assert.ok(result.Types);
				assert.ok(result.Types.Default);
				assert.strictEqual(result.Types.Default.length, 2);
				assert.ok(result.Types.Default.some(d => d.$.Extension === '.vsixmanifest' && d.$.ContentType === 'text/xml'));
				assert.ok(result.Types.Default.some(d => d.$.Extension === '.json' && d.$.ContentType === 'application/json'));
			});
	});

	it('should include extra extensions', () => {
		const files = [
			{ path: 'hello.txt', contents: '' },
			{ path: 'hello.png', contents: '' },
			{ path: 'hello.md', contents: '' },
			{ path: 'hello', contents: '' },
		];

		return toContentTypes(files)
			.then(xml => parseContentTypes(xml))
			.then(result => {
				assert.ok(result.Types.Default, 'there are content types');
				assert.ok(
					result.Types.Default.some(d => d.$.Extension === '.txt' && d.$.ContentType === 'text/plain'),
					'there are txt'
				);
				assert.ok(
					result.Types.Default.some(d => d.$.Extension === '.png' && d.$.ContentType === 'image/png'),
					'there are png'
				);
				assert.ok(
					result.Types.Default.some(d => d.$.Extension === '.md' && /^text\/(x-)?markdown$/.test(d.$.ContentType)),
					'there are md'
				);
				assert.ok(!result.Types.Default.some(d => d.$.Extension === ''));
			});
	});
});

describe('LaunchEntryPointProcessor', () => {
	it('should detect when declared entrypoint is not in package', async () => {
		const manifest = createManifest({ main: 'main.js' });
		const files = [{ path: 'extension/browser.js', contents: Buffer.from('') }];

		let didErr = false;

		try {
			await _toVsixManifest(manifest, files);
		} catch (err: any) {
			const message = err.message;
			didErr = message.includes('entrypoint(s) missing') && message.includes('main.js');
		}

		assert.ok(didErr);
	});

	it('should work even if .js extension is not used', async () => {
		const manifest = createManifest({ main: 'out/src/extension' });
		const files = [{ path: 'extension/out/src/extension.js', contents: Buffer.from('') }];
		await _toVsixManifest(manifest, files);
	});

	it('should accept manifest if no entrypoints defined', async () => {
		const manifest = createManifest({});
		const files = [{ path: 'extension/something.js', contents: Buffer.from('') }];
		await _toVsixManifest(manifest, files);
	});
});
describe('ManifestProcessor', () => {
	it('should ensure that package.json is writable', async () => {
		const root = fixture('uuid');
		const manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
		const processor = new ManifestProcessor(manifest);
		const packageJson = {
			path: 'extension/package.json',
			localPath: path.join(root, 'package.json'),
		};

		const outPackageJson = await processor.onFile(packageJson);
		assert.ok(outPackageJson.mode);
		assert.ok(outPackageJson.mode & 0o200);
	});

	it('should bump package.json version in-memory when using --no-update-package-json', async () => {
		const root = fixture('uuid');

		let manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
		assert.deepStrictEqual(manifest.version, '1.0.0');

		const processor = new ManifestProcessor(manifest, { version: '1.1.1', updatePackageJson: false });
		const packageJson = {
			path: 'extension/package.json',
			localPath: path.join(root, 'package.json'),
		};

		manifest = JSON.parse(await read(await processor.onFile(packageJson)));
		assert.deepStrictEqual(manifest.version, '1.1.1');
		assert.deepStrictEqual(processor.vsix.version, '1.1.1');

		manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
		assert.deepStrictEqual(manifest.version, '1.0.0');
	});

	it('should not bump package.json version in-memory when not using --no-update-package-json', async () => {
		const root = fixture('uuid');

		let manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
		assert.deepStrictEqual(manifest.version, '1.0.0');

		const processor = new ManifestProcessor(manifest, { version: '1.1.1' });
		const packageJson = {
			path: 'extension/package.json',
			localPath: path.join(root, 'package.json'),
		};

		manifest = JSON.parse(await read(await processor.onFile(packageJson)));
		assert.deepStrictEqual(manifest.version, '1.0.0');
		assert.deepStrictEqual(processor.vsix.version, '1.0.0');

		manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
		assert.deepStrictEqual(manifest.version, '1.0.0');
	});

	it('should not throw error for engine version with x (e.g. 1.95.x)', async () => {
		const root = fixture('uuid');
		const manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
		manifest.engines.vscode = '1.95.x';  // Non-strict semver, but acceptable

		assert.doesNotThrow(() => new ManifestProcessor(manifest, { target: 'web' }));
		assert.doesNotThrow(() => new ManifestProcessor(manifest, { preRelease: true }));
	});
});

describe('MarkdownProcessor', () => {
	it('should throw when no baseContentUrl is provided', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		let didThrow = false;

		try {
			await processor.onFile(readme);
		} catch (err: any) {
			didThrow = true;
		}

		assert.ok(didThrow);
	});

	it('should take baseContentUrl', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			baseContentUrl: 'https://github.com/username/repository/blob/master',
			baseImagesUrl: 'https://github.com/username/repository/raw/master',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.expected.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should infer baseContentUrl if its a github repo', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.default.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should replace relative links with GitHub URLs while respecting githubBranch', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			githubBranch: 'main',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.branch.main.expected.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should override image URLs with baseImagesUrl while also respecting githubBranch', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			githubBranch: 'main',
			// Override image relative links to point to different base URL
			baseImagesUrl: 'https://github.com/base',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises
					.readFile(path.join(root, 'readme.branch.override.images.expected.md'), 'utf8')
					.then(expected => {
						assert.strictEqual(actual, expected);
					});
			});
	});

	it('should override githubBranch setting with baseContentUrl', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			githubBranch: 'main',
			baseContentUrl: 'https://github.com/base',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises
					.readFile(path.join(root, 'readme.branch.override.content.expected.md'), 'utf8')
					.then(expected => {
						assert.strictEqual(actual, expected);
					});
			});
	});

	it('should infer baseContentUrl if its a github repo (.git)', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.default.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should infer baseContentUrl if its a github repo (short format)', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'github:username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.default.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should infer baseContentUrl if its a gitlab repo', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.gitlab.default.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should infer baseContentUrl if its a gitlab repo (.git)', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.gitlab.default.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should infer baseContentUrl if its a gitlab repo (short format)', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'gitlab:username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.gitlab.default.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should replace relative links with GitLab URLs while respecting gitlabBranch', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			gitlabBranch: 'main',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.gitlab.branch.main.expected.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should override image URLs with baseImagesUrl while also respecting gitlabBranch', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			gitlabBranch: 'main',
			// Override image relative links to point to different base URL
			baseImagesUrl: 'https://gitlab.com/base',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises
					.readFile(path.join(root, 'readme.gitlab.branch.override.images.expected.md'), 'utf8')
					.then(expected => {
						assert.strictEqual(actual, expected);
					});
			});
	});

	it('should override gitlabBranch setting with baseContentUrl', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {
			gitlabBranch: 'main',
			baseContentUrl: 'https://gitlab.com/base',
		});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises
					.readFile(path.join(root, 'readme.gitlab.branch.override.content.expected.md'), 'utf8')
					.then(expected => {
						assert.strictEqual(actual, expected);
					});
			});
	});

	it('should replace img urls with baseImagesUrl', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository.git',
		};

		const options = {
			baseImagesUrl: 'https://github.com/username/repository/path/to',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, options);
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.images.expected.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should replace issue links with urls if its a github repo.', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.github.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.github.expected.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should not replace issue links with urls if its a github repo but issue link expansion is disabled.', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, { gitHubIssueLinking: false });
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.github.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.github.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should not replace issue links with urls if its not a github repo.', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://some-other-provider.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.github.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.github.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should replace issue links with urls if its a gitlab repo.', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, {});
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.gitlab.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.gitlab.expected.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should not replace issue links with urls if its a gitlab repo but issue link expansion is disabled.', () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			description: 'test extension',
			engines: Object.create(null),
			repository: 'https://gitlab.com/username/repository.git',
		};

		const root = fixture('readme');
		const processor = new ReadmeProcessor(manifest, { gitLabIssueLinking: false });
		const readme = {
			path: 'extension/readme.md',
			localPath: path.join(root, 'readme.gitlab.md'),
		};

		return processor
			.onFile(readme)
			.then(file => read(file))
			.then(actual => {
				return fs.promises.readFile(path.join(root, 'readme.gitlab.md'), 'utf8').then(expected => {
					assert.strictEqual(actual, expected);
				});
			});
	});

	it('should prevent non-HTTPS images', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `![title](http://foo.png)`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should prevent non-HTTPS img tags', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `<img src="http://foo.png" />`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should prevent SVGs from not trusted sources', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `![title](https://foo/hello.svg)`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should allow SVGs from trusted sources', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `![title](https://badges.gitter.im/hello.svg)`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		const file = await processor.onFile(readme);
		assert.ok(file);
	});

	it('should allow SVG from GitHub actions in image tag (old url format)', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `![title](https://github.com/fakeuser/fakerepo/workflows/fakeworkflowname/badge.svg)`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		const file = await processor.onFile(readme);
		assert.ok(file);
	});

	it('should allow SVG from GitHub actions in image tag', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `![title](https://github.com/fakeuser/fakerepo/actions/workflows/fakeworkflowname/badge.svg)`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		const file = await processor.onFile(readme);
		assert.ok(file);
	});

	it('should prevent SVG from a GitHub repo in image tag', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `![title](https://github.com/eviluser/evilrepo/blob/master/malicious.svg)`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should prevent SVGs from not trusted sources in img tags', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `<img src="https://foo/hello.svg" />`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should allow SVGs from trusted sources in img tags', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `<img src="https://badges.gitter.im/hello.svg" />`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		const file = await processor.onFile(readme);
		assert.ok(file);
	});

	it('should prevent SVG tags', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path d="M224 387.814V512L32 320l192-192v126.912C447.375 260.152 437.794 103.016 380.93 0 521.287 151.707 491.48 394.785 224 387.814z"/></svg>`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should prevent SVG data urls in img tags', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBkPSJNMjI0IDM4Ny44MTRWNTEyTDMyIDMyMGwxOTItMTkydjEyNi45MTJDNDQ3LjM3NSAyNjAuMTUyIDQzNy43OTQgMTAzLjAxNiAzODAuOTMgMCA1MjEuMjg3IDE1MS43MDcgNDkxLjQ4IDM5NC43ODUgMjI0IDM4Ny44MTR6Ii8+PC9zdmc+" />`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});

	it('should allow img tags spanning across lines, issue #904', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `<img src="img/screenshots/demo.webp" width="556" height="482"\nalt="recording of  exploring view opened from the command 'Snippets Ranger: Show me that dur Range, Partner'. An entry of 'Markdown snippets' from the table of contents is selected and clicked, it takes the user down to the table with the snippets displayed for that extension."/>`;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		const file = await processor.onFile(readme);
		assert.ok(file);
	});

	it('should catch an unchanged README.md', async () => {
		const manifest = {
			name: 'test',
			publisher: 'mocha',
			version: '0.0.1',
			engines: Object.create(null),
			repository: 'https://github.com/username/repository',
		};
		const contents = `This is the README for your extension `;
		const processor = new ReadmeProcessor(manifest, {});
		const readme = { path: 'extension/readme.md', contents };

		await throws(() => processor.onFile(readme));
	});
});

describe('LicenseProcessor', () => {
	it('should fail if license file not specified', async () => {
		const originalUtilWarn = log.warn;
		const logs: string[] = [];

		log.warn = (message) => {
			logs.push(message);
		};

		const message = 'LICENSE, LICENSE.md, or LICENSE.txt not found';

		const processor = new LicenseProcessor(createManifest(), {});
		await processor.onEnd();

		log.warn = originalUtilWarn;

		assert.strictEqual(logs.length, 1);
		assert.strictEqual(logs[0], message);
	});

	it('should pass if no license specified and --skip-license flag is passed', async () => {
		const originalUtilWarn = log.warn;
		const logs: string[] = [];

		log.warn = (message) => {
			logs.push(message);
		};

		const processor = new LicenseProcessor(createManifest(), { skipLicense: true });
		await processor.onEnd();

		log.warn = originalUtilWarn;

		assert.strictEqual(logs.length, 0);
	});
});

describe('version', function () {
	this.timeout(5000);

	let dir: tmp.DirResult;
	const fixtureFolder = fixture('vsixmanifest');
	let cwd: string;

	const git = (args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf-8', shell: true });

	beforeEach(() => {
		dir = tmp.dirSync({ unsafeCleanup: true });
		cwd = dir.name;
		fs.copyFileSync(path.join(fixtureFolder, 'package.json'), path.join(cwd, 'package.json'));
		git(['init']);
		git(['config', '--local', 'user.name', 'Sample Name']);
		git(['config', '--local', 'user.email', 'sample@email.com']);
	});

	afterEach(() => {
		dir.removeCallback();
	});

	it('should bump patch version', async () => {
		await versionBump({ cwd, version: 'patch' });

		const newManifest = await readManifest(cwd);

		assert.strictEqual(newManifest.version, '1.0.1');
	});

	it('should bump minor version', async () => {
		await versionBump({ cwd, version: 'minor' });

		const newManifest = await readManifest(cwd);

		assert.strictEqual(newManifest.version, '1.1.0');
	});

	it('should bump major version', async () => {
		await versionBump({ cwd, version: 'major' });

		const newManifest = await readManifest(cwd);

		assert.strictEqual(newManifest.version, '2.0.0');
	});

	it('should set custom version', async () => {
		await versionBump({ cwd, version: '1.1.1' });

		const newManifest = await readManifest(cwd);

		assert.strictEqual(newManifest.version, '1.1.1');
	});

	it('should fail with invalid version', async () => {
		await assert.rejects(versionBump({ cwd, version: 'a1.a.2' }));
		await assert.rejects(versionBump({ cwd, version: 'prepatch' }));
		await assert.rejects(versionBump({ cwd, version: 'preminor' }));
		await assert.rejects(versionBump({ cwd, version: 'premajor' }));
		await assert.rejects(versionBump({ cwd, version: 'prerelease' }));
		await assert.rejects(versionBump({ cwd, version: 'from-git' }));
	});

	it('should create git tag and commit', async () => {
		await versionBump({ cwd, version: '1.1.1' });

		assert.strictEqual(git(['rev-parse', 'v1.1.1']).status, 0);
		assert.strictEqual(git(['rev-parse', 'HEAD']).status, 0);
	});

	it('should use custom commit message', async () => {
		const commitMessage = 'test commit message';
		await versionBump({ cwd, version: '1.1.1', commitMessage });

		assert.deepStrictEqual(git(['show', '-s', '--format=%B', 'HEAD']).stdout, `${commitMessage}\n\n`);
	});

	it('should not create git tag and commit', async () => {
		await versionBump({ cwd, version: '1.1.1', gitTagVersion: false });

		assert.notDeepStrictEqual(git(['rev-parse', 'v1.1.1']).status, 0);
		assert.notDeepStrictEqual(git(['rev-parse', 'HEAD']).status, 0);
	});

	it('should not write to package.json with --no-update-package-json', async () => {
		await versionBump({ cwd, version: '1.1.1', updatePackageJson: false });
		const newManifest = await readManifest(cwd);
		assert.strictEqual(newManifest.version, '1.0.0');
	});
});

describe('writeVsix', function () {
	this.timeout(60_000);

	it('should be reproducible', async () => {
		const exampleProject = fixture('manifestFiles');
		const fixtureDir = fixture('');

		const testDir = tmp.dirSync({ unsafeCleanup: true, tmpdir: fixtureDir });
		const cwd = testDir.name

		try {
			fs.cpSync(exampleProject, cwd, { recursive: true });

			const createVsix = async (vsixPath: string, epoch: number) => {
				process.env["SOURCE_DATE_EPOCH"] = `${epoch}`;
				await pack({ cwd, packagePath: vsixPath });
			}

			const vsix1 = testDir.name + '/vsix1.vsix';
			const vsix2 = testDir.name + '/vsix2.vsix';
			const vsix3 = testDir.name + '/vsix3.vsix';

			await createVsix(vsix1, 1000000000);
			await createVsix(vsix2, 1000000000);
			await createVsix(vsix3, 1000000002);

			const vsix1bytes = fs.readFileSync(vsix1);
			const vsix2bytes = fs.readFileSync(vsix2);
			const vsix3bytes = fs.readFileSync(vsix3);

			assert.deepStrictEqual(vsix1bytes, vsix2bytes);
			assert.notDeepStrictEqual(vsix1bytes, vsix3bytes);

		} finally {
			testDir.removeCallback();
		}
	});
});
