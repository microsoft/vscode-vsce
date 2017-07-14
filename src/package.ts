import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest } from './manifest';
import { ITranslations, patchNLS } from './nls';
import * as util from './util';
import * as _glob from 'glob';
import * as minimatch from 'minimatch';
import * as denodeify from 'denodeify';
import * as markdownit from 'markdown-it';
import * as cheerio from 'cheerio';
import * as url from 'url';
import * as mime from 'mime';
import * as urljoin from 'url-join';
import { validatePublisher, validateExtensionName, validateVersion, validateEngineCompatibility } from './validation';
import { getDependencies } from './npm';

interface IReadFile {
	(filePath: string): Promise<Buffer>;
	(filePath: string, encoding?: string): Promise<string>;
}

const readFile = denodeify<string, string, string>(fs.readFile);
const writeFile = denodeify<string, string, string, void>(fs.writeFile);
const unlink = denodeify<string, void>(fs.unlink);
const exec = denodeify<string, { cwd?: string; env?: any; }, { stdout: string; stderr: string; }>(cp.exec, (err, stdout, stderr) => [err, { stdout, stderr }]);
const glob = denodeify<string, _glob.Options, string[]>(_glob);

const resourcesPath = path.join(path.dirname(__dirname), 'resources');
const vsixManifestTemplatePath = path.join(resourcesPath, 'extension.vsixmanifest');
const contentTypesTemplatePath = path.join(resourcesPath, '[Content_Types].xml');

const MinimatchOptions = { dot: true };

export interface IFile {
	path: string;
	contents?: Buffer | string;
	localPath?: string;
}

export function read(file: IFile): Promise<string> {
	if (file.contents) {
		return Promise.resolve(file.contents).then(b => typeof b === 'string' ? b : b.toString('utf8'));
	} else {
		return readFile(file.localPath, 'utf8');
	}
}

export interface IPackageResult {
	manifest: Manifest;
	packagePath: string;
}

export interface IAsset {
	type: string;
	path: string;
}

export interface IPackageOptions {
	cwd?: string;
	packagePath?: string;
	baseContentUrl?: string;
	baseImagesUrl?: string;
}

export interface IProcessor {
	onFile(file: IFile): Promise<IFile>;
	onEnd(): Promise<void>;
	assets: IAsset[];
	vsix: any;
}

export class BaseProcessor implements IProcessor {
	constructor(protected manifest: Manifest) { }
	assets: IAsset[] = [];
	vsix: any = Object.create(null);
	onFile(file: IFile): Promise<IFile> { return Promise.resolve(file); }
	onEnd() { return Promise.resolve(null); }
}

function getUrl(url: string | { url?: string; }): string {
	if (!url) {
		return null;
	}

	if (typeof url === 'string') {
		return <string>url;
	}

	return (<any>url).url;
}

function getRepositoryUrl(url: string | { url?: string; }): string {
	const result = getUrl(url);

	if (/^[^\/]+\/[^\/]+$/.test(result)) {
		return `https://github.com/${result}.git`;
	}

	return result;
}

// Contributed by Mozilla develpoer authors
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

const TrustedSVGSources = [
	'vsmarketplacebadge.apphb.com',
	'travis-ci.org',
	'david-dm.org',
	'badges.gitter.im',
	'www.bithound.io',
	'img.shields.io',
	'gemnasium.com',
	'isitmaintained.com',
	'coveralls.io',
	'api.travis-ci.org',
	'codeclimate.com',
	'snyk.io',
	'badges.greenkeeper.io',
	'travis-ci.com',
	'badge.fury.io',
	'badges.frapsoft.com',
	'cdn.travis-ci.org',
	'marketplace.visualstudio.com',
	'ci.appveyor.com',
	'codecov.io'
];

function isHostTrusted(host: string): boolean {
	return TrustedSVGSources.indexOf(host.toLowerCase()) > -1;
}

class ManifestProcessor extends BaseProcessor {

	constructor(manifest: Manifest) {
		super(manifest);

		const flags = ['Public'];

		if (manifest.preview) {
			flags.push('Preview');
		}

		const repository = getRepositoryUrl(manifest.repository);
		const isGitHub = /^https:\/\/github\.com\/|^git@github\.com:/.test(repository || '');

		let enableMarketplaceQnA: boolean | undefined;
		let customerQnALink: string | undefined;

		if (manifest.qna === 'marketplace') {
			enableMarketplaceQnA = true;
		} else if (typeof manifest.qna === 'string') {
			customerQnALink = manifest.qna;
		} else if (manifest.qna === false) {
			enableMarketplaceQnA = false;
		}

		this.vsix = {
			...this.vsix,
			id: manifest.name,
			displayName: manifest.displayName || manifest.name,
			version: manifest.version,
			publisher: manifest.publisher,
			engine: manifest.engines['vscode'],
			description: manifest.description || '',
			categories: (manifest.categories || []).join(','),
			flags: flags.join(' '),
			links: {
				repository,
				bugs: getUrl(manifest.bugs),
				homepage: manifest.homepage
			},
			galleryBanner: manifest.galleryBanner || {},
			badges: manifest.badges,
			githubMarkdown: manifest.markdown !== 'standard',
			enableMarketplaceQnA,
			customerQnALink,
			extensionDependencies: _(manifest.extensionDependencies || []).uniq().join(',')
		};

		if (isGitHub) {
			this.vsix.links.github = repository;
		}
	}
}

export class TagsProcessor extends BaseProcessor {

	private static Keywords = {
		'git': ['git'],
		'npm': ['node'],
		'spell': ['markdown'],
		'bootstrap': ['bootstrap'],
		'lint': ['linters'],
		'linting': ['linters'],
		'react': ['javascript'],
		'js': ['javascript'],
		'node': ['javascript', 'node'],
		'c++': ['c++'],
		'Cplusplus': ['c++'],
		'xml': ['xml'],
		'angular': ['javascript'],
		'jquery': ['javascript'],
		'php': ['php'],
		'python': ['python'],
		'latex': ['latex'],
		'ruby': ['ruby'],
		'java': ['java'],
		'erlang': ['erlang'],
		'sql': ['sql'],
		'nodejs': ['node'],
		'c#': ['c#'],
		'css': ['css'],
		'javascript': ['javascript'],
		'ftp': ['ftp'],
		'haskell': ['haskell'],
		'unity': ['unity'],
		'terminal': ['terminal'],
		'powershell': ['powershell'],
		'laravel': ['laravel'],
		'meteor': ['meteor'],
		'emmet': ['emmet'],
		'eslint': ['linters'],
		'tfs': ['tfs'],
		'rust': ['rust']
	};

	onEnd(): Promise<void> {
		const keywords = this.manifest.keywords || [];
		const trimmedKeywords = keywords.slice(0, 5);

		let promise = Promise.resolve(trimmedKeywords);

		if (keywords.length > 5) {
			console.warn(`The keyword list is limited to 5 keywords; only the following keywords will be in your extension: [${trimmedKeywords.join(', ')}].`);
			promise = util.read('Do you want to continue? [y/N] ')
				.then(answer => /^y$/i.test(answer) ? Promise.resolve(trimmedKeywords) : Promise.reject('Aborted'));
		}

		return promise.then<any>(keywords => {
			const contributes = this.manifest.contributes;
			const activationEvents = this.manifest.activationEvents || [];
			const doesContribute = name => contributes && contributes[name] && contributes[name].length > 0;

			const colorThemes = doesContribute('themes') ? ['theme', 'color-theme'] : [];
			const iconThemes = doesContribute('iconThemes') ? ['theme', 'icon-theme'] : [];
			const snippets = doesContribute('snippets') ? ['snippet'] : [];
			const keybindings = doesContribute('keybindings') ? ['keybindings'] : [];
			const debuggers = doesContribute('debuggers') ? ['debuggers'] : [];
			const json = doesContribute('jsonValidation') ? ['json'] : [];

			const languageContributions = ((contributes && contributes['languages']) || [])
				.reduce((r, l) => r.concat([l.id]).concat(l.aliases || []).concat((l.extensions || []).map(e => `__ext_${e}`)), []);

			const languageActivations = activationEvents
				.map(e => /^onLanguage:(.*)$/.exec(e))
				.filter(r => !!r)
				.map(r => r[1]);

			const grammars = ((contributes && contributes['grammars']) || [])
				.map(g => g.language);

			const description = this.manifest.description || '';
			const descriptionKeywords = Object.keys(TagsProcessor.Keywords)
				.reduce((r, k) => r.concat(new RegExp('\\b(?:' + escapeRegExp(k) + ')(?!\\w)', 'gi').test(description) ? TagsProcessor.Keywords[k] : []), []);

			keywords = [
				...keywords,
				...colorThemes,
				...iconThemes,
				...snippets,
				...keybindings,
				...debuggers,
				...json,
				...languageContributions,
				...languageActivations,
				...grammars,
				...descriptionKeywords
			];

			this.vsix.tags = _(keywords)
				.uniq() // deduplicate
				.compact() // remove falsey values
				.join(',');
		});
	}
}

export class MarkdownProcessor extends BaseProcessor {

	private baseContentUrl: string;
	private baseImagesUrl: string;

	constructor(manifest: Manifest, private name: string, private regexp: RegExp, private assetType: string, options: IPackageOptions = {}) {
		super(manifest);

		const guess = this.guessBaseUrls();

		this.baseContentUrl = options.baseContentUrl || (guess && guess.content);
		this.baseImagesUrl = options.baseImagesUrl || options.baseContentUrl || (guess && guess.images);
	}

	async onFile(file: IFile): Promise<IFile> {
		const path = util.normalize(file.path);

		if (!this.regexp.test(path)) {
			return Promise.resolve(file);
		}

		this.assets.push({ type: this.assetType, path });

		let contents = await read(file);

		if (/This is the README for your extension /.test(contents)) {
			throw new Error(`Make sure to edit the README.md file before you publish your extension.`);
		}

		const markdownPathRegex = /(!?)\[([^\]\[]+|!\[[^\]\[]+]\([^\)]+\))\]\(([^\)]+)\)/g;
		const urlReplace = (all, isImage, title, link) => {
			const isLinkRelative = !/^\w+:\/\//.test(link) && link[0] !== '#';

			if (!this.baseContentUrl && !this.baseImagesUrl) {
				const asset = isImage ? 'image' : 'link';

				if (isLinkRelative) {
					throw new Error(`Couldn't detect the repository where this extension is published. The ${asset} '${link}' will be broken in ${this.name}. Please provide the repository URL in package.json or use the --baseContentUrl and --baseImagesUrl options.`);
				}
			}

			title = title.replace(markdownPathRegex, urlReplace);
			const prefix = isImage ? this.baseImagesUrl : this.baseContentUrl;

			if (!prefix || !isLinkRelative) {
				return `${isImage}[${title}](${link})`;
			}

			return `${isImage}[${title}](${urljoin(prefix, link)})`;
		};

		contents = contents.replace(markdownPathRegex, urlReplace);

		const html = markdownit({ html: true }).render(contents);
		const $ = cheerio.load(html);

		$('img').each((_, img) => {
			const src = decodeURI(img.attribs.src);
			const srcUrl = url.parse(src);

			if (/^data:$/i.test(srcUrl.protocol) && /^image$/i.test(srcUrl.host) && /\/svg/i.test(srcUrl.path)) {
				throw new Error(`SVG data URLs are not allowed in ${this.name}: ${src}`);
			}

			if (!/^https:$/i.test(srcUrl.protocol)) {
				throw new Error(`Images in ${this.name} must come from an HTTPS source: ${src}`);
			}

			if (/\.svg$/i.test(srcUrl.pathname) && !isHostTrusted(srcUrl.host)) {
				throw new Error(`SVGs are restricted in ${this.name}; please use other file image formats, such as PNG: ${src}`);
			}
		});

		$('svg').each((_, svg) => {
			throw new Error(`SVG tags are not allowed in ${this.name}.`);
		});

		return {
			path: file.path,
			contents: new Buffer(contents)
		};
	}

	// GitHub heuristics
	private guessBaseUrls(): { content: string; images: string; } {
		let repository = null;

		if (typeof this.manifest.repository === 'string') {
			repository = this.manifest.repository;
		} else if (this.manifest.repository && typeof this.manifest.repository['url'] === 'string') {
			repository = this.manifest.repository['url'];
		}

		if (!repository) {
			return null;
		}

		const regex = /github\.com\/([^/]+)\/([^/]+)(\/|$)/;
		const match = regex.exec(repository);

		if (!match) {
			return null;
		}

		const account = match[1];
		const repositoryName = match[2].replace(/\.git$/i, '');

		return {
			content: `https://github.com/${account}/${repositoryName}/blob/master`,
			images: `https://github.com/${account}/${repositoryName}/raw/master`
		};
	}
}

export class ReadmeProcessor extends MarkdownProcessor {

	constructor(manifest: Manifest, options: IPackageOptions = {}) {
		super(manifest, 'README.md', /^extension\/readme.md$/i, 'Microsoft.VisualStudio.Services.Content.Details', options);
	}
}
export class ChangelogProcessor extends MarkdownProcessor {

	constructor(manifest: Manifest, options: IPackageOptions = {}) {
		super(manifest, 'CHANGELOG.md', /^extension\/changelog.md$/i, 'Microsoft.VisualStudio.Services.Content.Changelog', options);
	}
}

class LicenseProcessor extends BaseProcessor {

	private didFindLicense = false;
	private filter: (name: string) => boolean;

	constructor(manifest: Manifest) {
		super(manifest);

		const match = /^SEE LICENSE IN (.*)$/.exec(manifest.license || '');

		if (!match || !match[1]) {
			this.filter = name => /^extension\/license(\.(md|txt))?$/i.test(name);
		} else {
			const regexp = new RegExp('^extension/' + match[1] + '$');
			this.filter = regexp.test.bind(regexp);
		}

		this.vsix.license = null;
	}

	onFile(file: IFile): Promise<IFile> {
		if (!this.didFindLicense) {
			let normalizedPath = util.normalize(file.path);

			if (this.filter(normalizedPath)) {
				if (!path.extname(normalizedPath)) {
					file.path += '.txt';
					normalizedPath += '.txt';
				}

				this.assets.push({ type: 'Microsoft.VisualStudio.Services.Content.License', path: normalizedPath });
				this.vsix.license = normalizedPath;
				this.didFindLicense = true;
			}
		}

		return Promise.resolve(file);
	}
}

class IconProcessor extends BaseProcessor {

	private icon: string;
	private didFindIcon = false;

	constructor(manifest: Manifest) {
		super(manifest);

		this.icon = manifest.icon ? `extension/${manifest.icon}` : null;
		this.vsix.icon = null;
	}

	onFile(file: IFile): Promise<IFile> {
		const normalizedPath = util.normalize(file.path);
		if (normalizedPath === this.icon) {
			this.didFindIcon = true;
			this.assets.push({ type: 'Microsoft.VisualStudio.Services.Icons.Default', path: normalizedPath });
			this.vsix.icon = this.icon;
		}
		return Promise.resolve(file);
	}

	onEnd(): Promise<void> {
		if (this.icon && !this.didFindIcon) {
			return Promise.reject(new Error(`The specified icon '${this.icon}' wasn't found in the extension.`));
		}

		return Promise.resolve(null);
	}
}

export function validateManifest(manifest: Manifest): Manifest {
	validatePublisher(manifest.publisher);
	validateExtensionName(manifest.name);

	if (!manifest.version) {
		throw new Error('Manifest missing field: version');
	}

	validateVersion(manifest.version);

	if (!manifest.engines) {
		throw new Error('Manifest missing field: engines');
	}

	if (!manifest.engines['vscode']) {
		throw new Error('Manifest missing field: engines.vscode');
	}

	validateEngineCompatibility(manifest.engines['vscode']);

	if (/\.svg$/i.test(manifest.icon || '')) {
		throw new Error(`SVGs can't be used as icons: ${manifest.icon}`);
	}

	(manifest.badges || []).forEach(badge => {
		const decodedUrl = decodeURI(badge.url);
		const srcUrl = url.parse(decodedUrl);

		if (!/^https:$/i.test(srcUrl.protocol)) {
			throw new Error(`Badge URLs must come from an HTTPS source: ${badge.url}`);
		}

		if (/\.svg$/i.test(srcUrl.pathname) && !isHostTrusted(srcUrl.host)) {
			throw new Error(`Badge SVGs are restricted. Please use other file image formats, such as PNG: ${badge.url}`);
		}
	});

	return manifest;
}

export function readManifest(cwd = process.cwd(), nls = true): Promise<Manifest> {
	const manifestPath = path.join(cwd, 'package.json');
	const manifestNLSPath = path.join(cwd, 'package.nls.json');

	const manifest = readFile(manifestPath, 'utf8')
		.catch(() => Promise.reject(`Extension manifest not found: ${manifestPath}`))
		.then<Manifest>(manifestStr => {
			try {
				return Promise.resolve(JSON.parse(manifestStr));
			} catch (e) {
				return Promise.reject(`Error parsing 'package.json' manifest file: not a valid JSON file.`);
			}
		})
		.then(validateManifest);

	if (!nls) {
		return manifest;
	}

	const manifestNLS = readFile(manifestNLSPath, 'utf8')
		.catch<string>(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve('{}'))
		.then<ITranslations>(raw => {
			try {
				return Promise.resolve(JSON.parse(raw));
			} catch (e) {
				return Promise.reject(`Error parsing JSON manifest translations file: ${manifestNLSPath}`);
			}
		});

	return Promise.all([manifest, manifestNLS]).then(([manifest, translations]) => {
		return patchNLS(manifest, translations);
	});

}

export function writeManifest(cwd: string, manifest: Manifest): Promise<void> {
	const manifestPath = path.join(cwd, 'package.json');
	return writeFile(manifestPath, JSON.stringify(manifest, null, 4), 'utf8');
}

export function toVsixManifest(assets: IAsset[], vsix: any, options: IPackageOptions = {}): Promise<string> {
	return readFile(vsixManifestTemplatePath, 'utf8')
		.then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
		.then(vsixManifestTemplate => vsixManifestTemplate(vsix));
}

const defaultExtensions = {
	'.json': 'application/json',
	'.vsixmanifest': 'text/xml'
};

export function toContentTypes(files: IFile[]): Promise<string> {
	const extensions = Object.keys(_.keyBy(files, f => path.extname(f.path).toLowerCase()))
		.filter(e => !!e)
		.reduce((r, e) => ({ ...r, [e]: mime.lookup(e) }), {});

	const allExtensions = { ...extensions, ...defaultExtensions };
	const contentTypes = Object.keys(allExtensions).map(extension => ({
		extension,
		contentType: allExtensions[extension]
	}));

	return readFile(contentTypesTemplatePath, 'utf8')
		.then(contentTypesTemplateStr => _.template(contentTypesTemplateStr))
		.then(contentTypesTemplate => contentTypesTemplate({ contentTypes }));
}

const defaultIgnore = [
	'.vscodeignore',
	'**/.git/**',
	'**/*.vsix',
	'**/.DS_Store',
	'**/*.vsixmanifest'
];

function collectAllFiles(cwd: string): Promise<string[]> {
	return getDependencies(cwd).then(deps => {
		const promises = deps.map(dep => {
			return glob('**', { cwd: dep, nodir: true, dot: true, ignore: 'node_modules/**' })
				.then(files => files
					.map(f => path.relative(cwd, path.join(dep, f)))
					.map(f => f.replace(/\\/g, '/')));
		});

		return Promise.all(promises).then(util.flatten);
	});
}

function collectFiles(cwd: string): Promise<string[]> {
	return collectAllFiles(cwd).then(files => {
		files = files.filter(f => !/\r$/m.test(f));

		return readFile(path.join(cwd, '.vscodeignore'), 'utf8')
			.catch<string>(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(''))
			.then(rawIgnore => rawIgnore.split(/[\n\r]/).map(s => s.trim()).filter(s => !!s))
			.then(ignore => [...defaultIgnore, ...ignore, '!package.json'])
			.then(ignore => ignore.filter(i => !/^\s*#/.test(i)))
			.then(ignore => _.partition(ignore, i => !/^\s*!/.test(i)))
			.then(r => ({ ignore: r[0], negate: r[1] }))
			.then(({ ignore, negate }) => files.filter(f => !ignore.some(i => minimatch(f, i, MinimatchOptions)) || negate.some(i => minimatch(f, i.substr(1), MinimatchOptions))));
	});
}

export function processFiles(processors: IProcessor[], files: IFile[], options: IPackageOptions = {}): Promise<IFile[]> {
	const processedFiles = files.map(file => util.chain(file, processors, (file, processor) => processor.onFile(file)));

	return Promise.all(processedFiles).then(files => {
		return Promise.all(processors.map(p => p.onEnd())).then(() => {
			const assets = _.flatten(processors.map(p => p.assets));
			const vsix = processors.reduce((r, p) => ({ ...r, ...p.vsix }), { assets });

			return Promise.all([toVsixManifest(assets, vsix, options), toContentTypes(files)]).then(result => {
				return [
					{ path: 'extension.vsixmanifest', contents: new Buffer(result[0], 'utf8') },
					{ path: '[Content_Types].xml', contents: new Buffer(result[1], 'utf8') },
					...files
				];
			});
		});
	});
}

export function createDefaultProcessors(manifest: Manifest, options: IPackageOptions = {}): IProcessor[] {
	return [
		new ManifestProcessor(manifest),
		new TagsProcessor(manifest),
		new ReadmeProcessor(manifest, options),
		new ChangelogProcessor(manifest, options),
		new LicenseProcessor(manifest),
		new IconProcessor(manifest)
	];
}

export function collect(manifest: Manifest, options: IPackageOptions = {}): Promise<IFile[]> {
	const cwd = options.cwd || process.cwd();
	const processors = createDefaultProcessors(manifest, options);

	return collectFiles(cwd).then(fileNames => {
		const files = fileNames.map(f => ({ path: `extension/${f}`, localPath: path.join(cwd, f) }));

		return processFiles(processors, files, options);
	});
}

function writeVsix(files: IFile[], packagePath: string): Promise<string> {
	return unlink(packagePath)
		.catch(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(null))
		.then(() => new Promise<string>((c, e) => {
			const zip = new yazl.ZipFile();
			files.forEach(f => f.contents ? zip.addBuffer(typeof f.contents === 'string' ? new Buffer(f.contents, 'utf8') : f.contents, f.path) : zip.addFile(f.localPath, f.path));
			zip.end();

			const zipStream = fs.createWriteStream(packagePath);
			zip.outputStream.pipe(zipStream);

			zip.outputStream.once('error', e);
			zipStream.once('error', e);
			zipStream.once('finish', () => c(packagePath));
		}));
}

function defaultPackagePath(cwd: string, manifest: Manifest): string {
	return path.join(cwd, `${manifest.name}-${manifest.version}.vsix`);
}

function prepublish(cwd: string, manifest: Manifest): Promise<Manifest> {
	if (!manifest.scripts || !manifest.scripts['vscode:prepublish']) {
		return Promise.resolve(manifest);
	}

	console.warn(`Executing prepublish script 'npm run vscode:prepublish'...`);

	return exec('npm run vscode:prepublish', { cwd })
		.then(({ stdout, stderr }) => {
			process.stdout.write(stdout);
			process.stderr.write(stderr);
			return Promise.resolve(manifest);
		})
		.catch(err => Promise.reject(err.message));
}

export function pack(options: IPackageOptions = {}): Promise<IPackageResult> {
	const cwd = options.cwd || process.cwd();

	return readManifest(cwd)
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collect(manifest, options)
			.then(files => writeVsix(files, path.resolve(options.packagePath || defaultPackagePath(cwd, manifest)))
				.then(packagePath => ({ manifest, packagePath }))));
}

export function packageCommand(options: IPackageOptions = {}): Promise<any> {
	return pack(options)
		.then(({ packagePath }) => console.log(`Created: ${packagePath}`));
}

/**
 * Lists the files included in the extension's package. Does not run prepublish.
 */
export function listFiles(cwd = process.cwd()): Promise<string[]> {
	return readManifest(cwd)
		.then(manifest => collectFiles(cwd));
}

/**
 * Lists the files included in the extension's package. Runs prepublish.
 */
export function ls(cwd = process.cwd()): Promise<void> {
	return readManifest(cwd)
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collectFiles(cwd))
		.then(files => files.forEach(f => console.log(`${f}`)));
}
