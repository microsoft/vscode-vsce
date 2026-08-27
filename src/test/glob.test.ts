import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as assert from 'assert';
import { IListFilesOptions, listFiles } from '../package';
import { ManifestPackage } from '../manifest';

/**
 * These tests pin down the exact behaviour of the file collection layer:
 * which files are discovered on disk (globbing) and which of them survive the
 * `.vscodeignore` / `package.json` `files` rules.
 *
 * They exist to guarantee that swapping the underlying glob implementation
 * does not change what ends up inside a `.vsix`.
 */

type Tree = Record<string, string | null>;

const defaultManifest = {
	name: 'test',
	publisher: 'mocha',
	version: '0.0.1',
	description: 'test extension',
	engines: { vscode: '*' },
};

const tempRoots: string[] = [];

function createTree(root: string, tree: Tree): void {
	for (const [relativePath, contents] of Object.entries(tree)) {
		const absolutePath = path.join(root, relativePath);

		if (contents === null) {
			fs.mkdirSync(absolutePath, { recursive: true });
		} else {
			fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
			fs.writeFileSync(absolutePath, contents);
		}
	}
}

function createExtension(tree: Tree = {}, options: { dirName?: string; manifest?: object } = {}): string {
	const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'vsce-glob-'));
	tempRoots.push(root);

	const cwd = options.dirName ? path.join(root, options.dirName) : root;
	fs.mkdirSync(cwd, { recursive: true });

	createTree(cwd, { 'package.json': JSON.stringify(options.manifest ?? defaultManifest, null, 2), ...tree });

	return cwd;
}

function readManifestSync(cwd: string): ManifestPackage {
	return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as ManifestPackage;
}

async function list(cwd: string, options: Partial<IListFilesOptions> = {}): Promise<string[]> {
	const manifest = options.manifest ?? readManifestSync(cwd);
	const files = await listFiles({ dependencies: false, ...options, cwd, manifest });
	return files.slice().sort();
}

function createSymlink(target: string, linkPath: string, type: 'file' | 'dir' | 'junction'): boolean {
	try {
		fs.symlinkSync(target, linkPath, type);
		return true;
	} catch {
		// Creating symlinks requires elevation or developer mode on Windows
		return false;
	}
}

after(() => {
	for (const root of tempRoots) {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

describe('glob: file discovery', function () {
	this.timeout(60000);

	it('should find files in nested directories', async () => {
		const cwd = createExtension({
			'a.txt': '',
			'dir/b.txt': '',
			'dir/sub/c.txt': '',
			'dir/sub/deep/deeper/d.txt': '',
		});

		assert.deepStrictEqual(await list(cwd), [
			'a.txt',
			'dir/b.txt',
			'dir/sub/c.txt',
			'dir/sub/deep/deeper/d.txt',
			'package.json',
		]);
	});

	it('should find dot files and files in dot directories', async () => {
		const cwd = createExtension({
			'.hidden': '',
			'.hiddendir/file.txt': '',
			'.hiddendir/.hidden': '',
			'dir/.hidden': '',
		});

		assert.deepStrictEqual(await list(cwd), [
			'.hidden',
			'.hiddendir/.hidden',
			'.hiddendir/file.txt',
			'dir/.hidden',
			'package.json',
		]);
	});

	it('should not return directories', async () => {
		const cwd = createExtension({
			'empty': null,
			'empty/nested': null,
			'nonempty': null,
			'nonempty/file.txt': '',
		});

		assert.deepStrictEqual(await list(cwd), ['nonempty/file.txt', 'package.json']);
	});

	it('should always return forward slash separated relative paths', async () => {
		const cwd = createExtension({ 'a/b/c/d.txt': '' });
		const files = await list(cwd);

		assert.ok(!files.some(f => f.includes('\\')), `Unexpected backslash in ${JSON.stringify(files)}`);
		assert.ok(!files.some(f => path.isAbsolute(f)), `Unexpected absolute path in ${JSON.stringify(files)}`);
		assert.ok(!files.some(f => f.startsWith('./')), `Unexpected './' prefix in ${JSON.stringify(files)}`);
		assert.deepStrictEqual(files, ['a/b/c/d.txt', 'package.json']);
	});

	it('should ignore the root node_modules folder', async () => {
		const cwd = createExtension({
			'node_modules/dep/index.js': '',
			'node_modules/.bin/dep': '',
			'node_modules/dep/node_modules/nested/index.js': '',
			'src/index.js': '',
		});

		assert.deepStrictEqual(await list(cwd), ['package.json', 'src/index.js']);
	});

	it('should ignore a differently cased node_modules folder on Windows and macOS', async () => {
		const cwd = createExtension({ 'Node_Modules/dep/index.js': '', 'src/index.js': '' });
		const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';

		assert.deepStrictEqual(
			await list(cwd),
			caseInsensitive
				? ['package.json', 'src/index.js']
				: ['Node_Modules/dep/index.js', 'package.json', 'src/index.js']
		);
	});

	it('should not ignore nested node_modules folders', async () => {
		const cwd = createExtension({
			'packages/a/node_modules/dep/index.js': '',
			'packages/a/index.js': '',
		});

		assert.deepStrictEqual(await list(cwd), [
			'package.json',
			'packages/a/index.js',
			'packages/a/node_modules/dep/index.js',
		]);
	});

	it('should find files whose names contain glob special characters', async () => {
		const tree: Tree = {
			'[brackets].txt': '',
			'(parens).txt': '',
			'{braces}.txt': '',
			'plus+file.txt': '',
			'at@file.txt': '',
			'!bang.txt': '',
			'hash#file.txt': '',
			'dollar$file.txt': '',
			'percent%file.txt': '',
			'caret^file.txt': '',
			'tilde~file.txt': '',
			'comma,file.txt': '',
			'equals=file.txt': '',
			'ampersand&file.txt': '',
			'space file.txt': '',
			'unicode-ü-🎉.txt': '',
			'[dir]/(nested)/{file}.txt': '',
		};

		if (process.platform !== 'win32') {
			tree['star*file.txt'] = '';
			tree['question?file.txt'] = '';
		}

		const cwd = createExtension(tree);
		const files = await list(cwd);

		for (const expected of Object.keys(tree)) {
			assert.ok(
				files.includes(expected.replace(/\\/g, '/')),
				`Expected to find ${expected} in ${JSON.stringify(files)}`
			);
		}

		assert.strictEqual(files.length, Object.keys(tree).length + 1 /* package.json */);
	});

	it('should work when the extension folder contains glob special characters', async () => {
		const cwd = createExtension(
			{ 'src/index.js': '', 'dir/file.txt': '' },
			{ dirName: 'my (weird) [extension] {folder} +name' }
		);

		assert.deepStrictEqual(await list(cwd), ['dir/file.txt', 'package.json', 'src/index.js']);
	});

	it('should include symlinked files', async function () {
		const cwd = createExtension({ 'real/file.txt': 'hello' });

		if (!createSymlink(path.join(cwd, 'real', 'file.txt'), path.join(cwd, 'link.txt'), 'file')) {
			this.skip();
		}

		assert.deepStrictEqual(await list(cwd), ['link.txt', 'package.json', 'real/file.txt']);
	});

	it('should not follow symlinked directories by default', async function () {
		const cwd = createExtension({ 'real/file.txt': 'hello' });

		if (!createSymlink(path.join(cwd, 'real'), path.join(cwd, 'link'), 'junction')) {
			this.skip();
		}

		// The link itself is reported as an entry, but it is not traversed
		assert.deepStrictEqual(await list(cwd), ['link', 'package.json', 'real/file.txt']);
	});

	it('should follow symlinked directories when followSymlinks is enabled', async function () {
		const cwd = createExtension({ 'real/file.txt': 'hello' });

		if (!createSymlink(path.join(cwd, 'real'), path.join(cwd, 'link'), 'junction')) {
			this.skip();
		}

		assert.deepStrictEqual(await list(cwd, { followSymlinks: true }), [
			'link/file.txt',
			'package.json',
			'real/file.txt',
		]);
	});

	// A dangling symlink is reported as a file when symlinks are not followed, but is skipped
	// when they are, since there is nothing to resolve it to
	it('should include a broken symlink', async function () {
		const cwd = createExtension({ 'real/file.txt': 'hello' });

		if (!createSymlink(path.join(cwd, 'missing.txt'), path.join(cwd, 'broken.txt'), 'file')) {
			this.skip();
		}

		assert.deepStrictEqual(await list(cwd), ['broken.txt', 'package.json', 'real/file.txt']);
	});

	it('should skip a broken symlink when followSymlinks is enabled', async function () {
		const cwd = createExtension({ 'real/file.txt': 'hello' });

		if (!createSymlink(path.join(cwd, 'missing.txt'), path.join(cwd, 'broken.txt'), 'file')) {
			this.skip();
		}

		assert.deepStrictEqual(await list(cwd, { followSymlinks: true }), ['package.json', 'real/file.txt']);
	});

	it('should collect the files of a root reached through a symlink', async function () {
		const target = createExtension({ 'src/index.js': '', 'nested/deep/file.txt': '' }, { dirName: 'extension' });
		const link = path.join(path.dirname(target), 'link');

		if (!createSymlink(target, link, 'junction')) {
			this.skip();
		}

		// The root is resolved by the filesystem, so its contents are collected as usual. This
		// is the shape yarn workspaces produce, where every dependency root is a symlink.
		assert.deepStrictEqual(await list(link), ['nested/deep/file.txt', 'package.json', 'src/index.js']);
	});

	it('should not follow a symlink nested inside a followed symlink', async function () {
		const cwd = createExtension({ 'target/keep.txt': '', 'target/sub/nested.txt': '' });

		if (
			!createSymlink(path.join(cwd, 'target'), path.join(cwd, 'link'), 'junction') ||
			!createSymlink(path.join(cwd, 'target', 'sub'), path.join(cwd, 'target', 'innerlink'), 'junction')
		) {
			this.skip();
		}

		// A symlink resolving inside an already followed symlink is treated as recursive, so
		// 'link/innerlink/nested.txt' is not collected. This pins the cycle detection heuristic
		// of the underlying crawler rather than a guaranteed contract, so an upstream update
		// changing it is expected to fail this test.
		assert.deepStrictEqual(await list(cwd, { followSymlinks: true }), [
			'link/keep.txt',
			'link/sub/nested.txt',
			'package.json',
			'target/innerlink/nested.txt',
			'target/keep.txt',
			'target/sub/nested.txt',
		]);
	});
});

describe('glob: default ignore rules', function () {
	this.timeout(60000);

	it('should ignore the default ignore list', async () => {
		const cwd = createExtension({
			'.vscodeignore': '',
			'package-lock.json': '',
			'npm-debug.log': '',
			'yarn.lock': '',
			'yarn-error.log': '',
			'npm-shrinkwrap.json': '',
			'.editorconfig': '',
			'.npmrc': '',
			'.yarnrc': '',
			'.gitattributes': '',
			'notes.todo': '',
			'tslint.yaml': '',
			'.eslintrc.json': '',
			'.babelrc': '',
			'.prettierrc.yaml': '',
			'.cz-config.js': '',
			'.commitlintrc.json': '',
			'webpack.config.js': '',
			'ISSUE_TEMPLATE.md': '',
			'CONTRIBUTING.md': '',
			'PULL_REQUEST_TEMPLATE.md': '',
			'CODE_OF_CONDUCT.md': '',
			'.travis.yml': '',
			'appveyor.yml': '',
			'.git/HEAD': '',
			'nested/.git/HEAD': '',
			'some.vsix': '',
			'nested/some.vsix': '',
			'.DS_Store': '',
			'nested/.DS_Store': '',
			'extension.vsixmanifest': '',
			'nested/extension.vsixmanifest': '',
			'.vscode-test/user-data/settings.json': '',
			'.vscode-test-web/user-data/settings.json': '',
			'src/index.js': '',
		});

		assert.deepStrictEqual(await list(cwd), ['package.json', 'src/index.js']);
	});

	it('should not ignore files that only look like default ignores', async () => {
		const cwd = createExtension({
			'.vscodeignore': '',
			'nested/package-lock.json': '',
			'nested/yarn.lock': '',
			'nested/webpack.config.js': '',
			'nested/CONTRIBUTING.md': '',
			'nested/.editorconfig': '',
			'nested/tslint.yaml': '',
			'nested/.eslintrc.json': '',
			'nested/.vscodeignore': '',
			'gitattributes': '',
			'webpack.config.ts': '',
		});

		assert.deepStrictEqual(await list(cwd), [
			'gitattributes',
			'nested/.editorconfig',
			'nested/.eslintrc.json',
			'nested/.vscodeignore',
			'nested/CONTRIBUTING.md',
			'nested/package-lock.json',
			'nested/tslint.yaml',
			'nested/webpack.config.js',
			'nested/yarn.lock',
			'package.json',
			'webpack.config.ts',
		]);
	});

	it('should not ignore the .github folder contents by default', async () => {
		const cwd = createExtension({
			'.vscodeignore': '',
			'.github': null,
			'.github/workflows/ci.yml': '',
			'.github/dependabot.yml': '',
		});

		assert.deepStrictEqual(await list(cwd), [
			'.github/dependabot.yml',
			'.github/workflows/ci.yml',
			'package.json',
		]);
	});

	it('should always include package.json and the readme', async () => {
		const cwd = createExtension({
			'.vscodeignore': '**',
			'README.md': '',
			'src/index.js': '',
		});

		assert.deepStrictEqual(await list(cwd), ['README.md', 'package.json']);
	});

	it('should always include a custom readme path', async () => {
		const cwd = createExtension({
			'.vscodeignore': '**',
			'README.md': '',
			'docs/readme.md': '',
		});

		assert.deepStrictEqual(await list(cwd, { readmePath: 'docs/readme.md' }), ['docs/readme.md', 'package.json']);
	});
});

describe('glob: .vscodeignore rules', function () {
	this.timeout(60000);

	async function ignoreTest(ignore: string, tree: Tree, expected: string[]): Promise<void> {
		const cwd = createExtension({ ...tree, '.vscodeignore': ignore });
		assert.deepStrictEqual(await list(cwd), expected.slice().sort());
	}

	it('should ignore a plain file name at the root only', () =>
		ignoreTest('out.js\n', { 'out.js': '', 'nested/out.js': '' }, ['package.json', 'nested/out.js']));

	it('should ignore a file name anywhere with **/', () =>
		ignoreTest('**/out.js\n', { 'out.js': '', 'nested/out.js': '' }, ['package.json']));

	it('should expand a folder name into a recursive ignore', () =>
		ignoreTest(
			'out\n',
			{ 'out/a.js': '', 'out/nested/b.js': '', 'out.js': '', 'nested/out/c.js': '' },
			['package.json', 'out.js', 'nested/out/c.js']
		));

	it('should expand a folder name with a trailing slash into a recursive ignore', () =>
		ignoreTest('out/\n', { 'out/a.js': '', 'out/nested/b.js': '', 'out.js': '' }, ['package.json', 'out.js']));

	it('should support an explicit recursive folder ignore', () =>
		ignoreTest('out/**\n', { 'out/a.js': '', 'out/nested/b.js': '', 'out.js': '' }, ['package.json', 'out.js']));

	it('should support nested folder paths', () =>
		ignoreTest(
			'src/test\n',
			{ 'src/test/a.js': '', 'src/test/nested/b.js': '', 'src/index.js': '', 'test/c.js': '' },
			['package.json', 'src/index.js', 'test/c.js']
		));

	it('should support extension globs', () =>
		ignoreTest(
			'*.ts\n',
			{ 'a.ts': '', 'nested/b.ts': '', 'a.js': '' },
			['package.json', 'a.js', 'nested/b.ts']
		));

	it('should support recursive extension globs', () =>
		ignoreTest('**/*.ts\n', { 'a.ts': '', 'nested/b.ts': '', 'a.js': '' }, ['package.json', 'a.js']));

	it('should support single star globs matching a single path segment', () =>
		ignoreTest(
			'src/*/index.js\n',
			{ 'src/a/index.js': '', 'src/a/b/index.js': '', 'src/index.js': '' },
			['package.json', 'src/a/b/index.js', 'src/index.js']
		));

	it('should support globstar in the middle of a pattern', () =>
		ignoreTest(
			'src/**/index.js\n',
			{ 'src/a/index.js': '', 'src/a/b/index.js': '', 'src/index.js': '', 'index.js': '' },
			['package.json', 'index.js']
		));

	it('should support brace expansion', () =>
		ignoreTest(
			'*.{ts,map}\n',
			{ 'a.ts': '', 'a.map': '', 'a.js': '' },
			['package.json', 'a.js']
		));

	it('should support character classes', () =>
		ignoreTest(
			'file[0-9].txt\n',
			{ 'file1.txt': '', 'file9.txt': '', 'filea.txt': '' },
			['package.json', 'filea.txt']
		));

	it('should support extglobs', () =>
		ignoreTest(
			'+(drop|remove).txt\n',
			{ 'keep.txt': '', 'drop.txt': '', 'remove.txt': '' },
			['package.json', 'keep.txt']
		));

	it('should support extglobs in a nested position', () =>
		ignoreTest(
			'out/!(keep).js\n',
			{ 'out/keep.js': '', 'out/drop.js': '' },
			['package.json', 'out/keep.js']
		));

	it('should treat a leading ! as a negation rather than an extglob', () =>
		ignoreTest(
			'**\n!(drop).txt\n',
			{ 'keep.txt': '', 'drop.txt': '', '(drop).txt': '' },
			['package.json', '(drop).txt']
		));

	it('should match dot files with star patterns', () =>
		ignoreTest('*\n', { '.hidden': '', 'visible.txt': '' }, ['package.json']));

	it('should match dot files inside ignored folders', () =>
		ignoreTest('out\n', { 'out/.hidden': '', 'out/a.js': '' }, ['package.json']));

	it('should ignore everything with a globstar', () =>
		ignoreTest('**\n', { 'a.js': '', 'nested/b.js': '', '.hidden': '' }, ['package.json']));

	it('should skip empty lines and comments', () =>
		ignoreTest(
			'\n# a comment\n   # indented comment\n\nout\n\n',
			{ 'out/a.js': '', '# a comment': '', 'keep.js': '' },
			['package.json', '# a comment', 'keep.js']
		));

	it('should trim leading and trailing whitespace', () =>
		ignoreTest('   out   \n\t*.ts\t\n', { 'out/a.js': '', 'a.ts': '', 'keep.js': '' }, ['package.json', 'keep.js']));

	it('should support CRLF line endings', () =>
		ignoreTest('out\r\n*.ts\r\n', { 'out/a.js': '', 'a.ts': '', 'keep.js': '' }, ['package.json', 'keep.js']));

	it('should support CR only line endings', () =>
		ignoreTest('out\r*.ts\r', { 'out/a.js': '', 'a.ts': '', 'keep.js': '' }, ['package.json', 'keep.js']));

	it('should support negated patterns', () =>
		ignoreTest(
			'out\n!out/keep.js\n',
			{ 'out/keep.js': '', 'out/drop.js': '' },
			['package.json', 'out/keep.js']
		));

	it('should expand negated folder patterns', () =>
		ignoreTest(
			'out\n!out/keep\n',
			{ 'out/keep/a.js': '', 'out/keep/nested/b.js': '', 'out/drop.js': '' },
			['package.json', 'out/keep/a.js', 'out/keep/nested/b.js']
		));

	it('should apply negated patterns regardless of their position', () =>
		ignoreTest(
			'!out/keep.js\nout\n',
			{ 'out/keep.js': '', 'out/drop.js': '' },
			['package.json', 'out/keep.js']
		));

	it('should support negated glob patterns', () =>
		ignoreTest(
			'**\n!src/**/*.js\n',
			{ 'src/a.js': '', 'src/nested/b.js': '', 'src/a.ts': '' },
			['package.json', 'src/a.js', 'src/nested/b.js']
		));

	it('should support un-ignoring a default ignored file', () =>
		ignoreTest('!webpack.config.js\n', { 'webpack.config.js': '' }, ['package.json', 'webpack.config.js']));

	it('should ignore the ignore file itself', () =>
		ignoreTest('nothing\n', {}, ['package.json']));

	it('should support a custom ignore file', async () => {
		const cwd = createExtension({
			'.vscodeignore': 'src/**',
			'custom.ignore': 'out/**',
			'src/a.js': '',
			'out/b.js': '',
		});

		// .vscodeignore is part of the default ignore list, even when unused
		assert.deepStrictEqual(await list(cwd, { ignoreFile: path.join(cwd, 'custom.ignore') }), [
			'custom.ignore',
			'package.json',
			'src/a.js',
		]);
	});

	it('should fail when the custom ignore file does not exist', async () => {
		const cwd = createExtension({ 'src/a.js': '' });

		await assert.rejects(() => list(cwd, { ignoreFile: path.join(cwd, 'does-not-exist.ignore') }));
	});
});

describe('glob: package.json files property', function () {
	this.timeout(60000);

	async function filesTest(files: string[], tree: Tree, expected: string[]): Promise<void> {
		const cwd = createExtension(tree, { manifest: { ...defaultManifest, files } });
		assert.deepStrictEqual(await list(cwd), expected.slice().sort());
	}

	it('should only include listed files', () =>
		filesTest(['src/a.js'], { 'src/a.js': '', 'src/b.js': '', 'out/c.js': '' }, ['package.json', 'src/a.js']));

	it('should expand listed folders recursively', () =>
		filesTest(
			['src'],
			{ 'src/a.js': '', 'src/nested/b.js': '', 'out/c.js': '' },
			['package.json', 'src/a.js', 'src/nested/b.js']
		));

	it('should expand listed folders with a trailing slash', () =>
		filesTest(['src/'], { 'src/a.js': '', 'src/nested/b.js': '', 'out/c.js': '' }, [
			'package.json',
			'src/a.js',
			'src/nested/b.js',
		]));

	it('should support globs', () =>
		filesTest(
			['src/*.js'],
			{ 'src/a.js': '', 'src/nested/b.js': '', 'src/a.ts': '' },
			['package.json', 'src/a.js']
		));

	it('should support globstars', () =>
		filesTest(
			['src/**/*.js'],
			{ 'src/a.js': '', 'src/nested/b.js': '', 'src/a.ts': '' },
			['package.json', 'src/a.js', 'src/nested/b.js']
		));

	it('should support multiple entries', () =>
		filesTest(
			['src', 'out/c.js', '*.md'],
			{ 'src/a.js': '', 'out/c.js': '', 'out/d.js': '', 'CHANGELOG.md': '' },
			['package.json', 'src/a.js', 'out/c.js', 'CHANGELOG.md']
		));

	it('should include dot files matched by a folder entry', () =>
		filesTest(['src'], { 'src/.hidden': '', 'src/a.js': '' }, ['package.json', 'src/.hidden', 'src/a.js']));

	it('should take precedence over the default ignore list', () =>
		filesTest(
			['src'],
			{ 'src/a.js': '', 'src/.DS_Store': '', 'src/a.vsix': '', 'src/webpack.config.js': '' },
			['package.json', 'src/.DS_Store', 'src/a.js', 'src/a.vsix', 'src/webpack.config.js']
		));

	it('should still apply the default ignore list to files that are not listed', () =>
		filesTest(
			['src'],
			{ 'src/a.js': '', '.DS_Store': '', 'a.vsix': '', 'webpack.config.js': '' },
			['package.json', 'src/a.js']
		));

	it('should include everything for a globstar entry', () =>
		filesTest(
			['**'],
			{ 'src/a.js': '', 'src/.DS_Store': '', 'a.vsix': '', 'yarn.lock': '' },
			['package.json', 'src/a.js', 'src/.DS_Store', 'a.vsix', 'yarn.lock']
		));

	it('should always include package.json and the readme', () =>
		filesTest(['src'], { 'src/a.js': '', 'README.md': '', 'other.md': '' }, [
			'package.json',
			'README.md',
			'src/a.js',
		]));

	it('should include nothing extra when the list is empty', () =>
		filesTest([], { 'src/a.js': '', 'README.md': '' }, ['package.json', 'README.md']));

	it('should be ignored when a .vscodeignore file exists', async () => {
		const cwd = createExtension(
			{ '.vscodeignore': 'out/**', 'src/a.js': '', 'out/b.js': '' },
			{ manifest: { ...defaultManifest, files: ['out'] } }
		);

		assert.deepStrictEqual(await list(cwd), ['package.json', 'src/a.js']);
	});
});
