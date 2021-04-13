import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { ExtensionKind, Manifest } from './manifest';
import { ITranslations, patchNLS } from './nls';
import * as util from './util';
import * as _glob from 'glob';
import * as minimatch from 'minimatch';
import * as denodeify from 'denodeify';
import * as markdownit from 'markdown-it';
import * as cheerio from 'cheerio';
import * as url from 'url';
import { lookup } from 'mime';
import * as urljoin from 'url-join';
import {
	validatePublisher,
	validateExtensionName,
	validateVersion,
	validateEngineCompatibility,
	validateVSCodeTypesCompatibility,
} from './validation';
import { detectYarn, getDependencies } from './npm';
import { IExtensionsReport } from './publicgalleryapi';

const readFile = denodeify<string, string, string>(fs.readFile);
const unlink = denodeify<string, void>(fs.unlink as any);
const stat = denodeify(fs.stat);
const glob = denodeify<string, _glob.IOptions, string[]>(_glob);

const resourcesPath = path.join(path.dirname(__dirname), 'resources');
const vsixManifestTemplatePath = path.join(resourcesPath, 'extension.vsixmanifest');
const contentTypesTemplatePath = path.join(resourcesPath, '[Content_Types].xml');

const MinimatchOptions: minimatch.IOptions = { dot: true };

export interface IInMemoryFile {
	path: string;
	mode?: number;
	readonly contents: Buffer | string;
}

export interface ILocalFile {
	path: string;
	mode?: number;
	readonly localPath: string;
}

export type IFile = IInMemoryFile | ILocalFile;

function isInMemoryFile(file: IFile): file is IInMemoryFile {
	return !!(file as IInMemoryFile).contents;
}

export function read(file: IFile): Promise<string> {
	if (isInMemoryFile(file)) {
		return Promise.resolve(file.contents).then(b => (typeof b === 'string' ? b : b.toString('utf8')));
	} else {
		return readFile(file.localPath, 'utf8');
	}
}

export interface IPackage {
	manifest: Manifest;
	packagePath: string;
}

export interface IPackageResult extends IPackage {
	files: IFile[];
}

export interface IAsset {
	type: string;
	path: string;
}

export interface IPackageOptions {
	readonly cwd?: string;
	readonly packagePath?: string;
	readonly githubBranch?: string;
	readonly baseContentUrl?: string;
	readonly baseImagesUrl?: string;
	readonly useYarn?: boolean;
	readonly dependencyEntryPoints?: string[];
	readonly ignoreFile?: string;
	readonly gitHubIssueLinking?: boolean;
	readonly web?: boolean;
}

export interface IProcessor {
	onFile(file: IFile): Promise<IFile>;
	onEnd(): Promise<void>;
	assets: IAsset[];
	tags: string[];
	vsix: any;
}

export class BaseProcessor implements IProcessor {
	constructor(protected manifest: Manifest) {}
	assets: IAsset[] = [];
	tags: string[] = [];
	vsix: any = Object.create(null);
	onFile(file: IFile): Promise<IFile> {
		return Promise.resolve(file);
	}
	onEnd() {
		return Promise.resolve(null);
	}
}

function getUrl(url: string | { url?: string }): string {
	if (!url) {
		return null;
	}

	if (typeof url === 'string') {
		return <string>url;
	}

	return (<any>url).url;
}

function getRepositoryUrl(url: string | { url?: string }): string {
	const result = getUrl(url);

	if (/^[^\/]+\/[^\/]+$/.test(result)) {
		return `https://github.com/${result}.git`;
	}

	return result;
}

// Contributed by Mozilla develpoer authors
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function toExtensionTags(extensions: string[]): string[] {
	return extensions
		.map(s => s.replace(/\W/g, ''))
		.filter(s => !!s)
		.map(s => `__ext_${s}`);
}

function toLanguagePackTags(translations: { id: string }[], languageId: string): string[] {
	return (translations || [])
		.map(({ id }) => [`__lp_${id}`, `__lp-${languageId}_${id}`])
		.reduce((r, t) => [...r, ...t], []);
}

/* This list is also maintained by the Marketplace team.
 * Remember to reach out to them when adding new domains.
 */
const TrustedSVGSources = [
	'api.bintray.com',
	'api.travis-ci.com',
	'api.travis-ci.org',
	'app.fossa.io',
	'badge.buildkite.com',
	'badge.fury.io',
	'badge.waffle.io',
	'badgen.net',
	'badges.frapsoft.com',
	'badges.gitter.im',
	'badges.greenkeeper.io',
	'cdn.travis-ci.com',
	'cdn.travis-ci.org',
	'ci.appveyor.com',
	'circleci.com',
	'cla.opensource.microsoft.com',
	'codacy.com',
	'codeclimate.com',
	'codecov.io',
	'coveralls.io',
	'david-dm.org',
	'deepscan.io',
	'dev.azure.com',
	'docs.rs',
	'flat.badgen.net',
	'gemnasium.com',
	'githost.io',
	'gitlab.com',
	'godoc.org',
	'goreportcard.com',
	'img.shields.io',
	'isitmaintained.com',
	'marketplace.visualstudio.com',
	'nodesecurity.io',
	'opencollective.com',
	'snyk.io',
	'travis-ci.com',
	'travis-ci.org',
	'visualstudio.com',
	'vsmarketplacebadge.apphb.com',
	'www.bithound.io',
	'www.versioneye.com',
];

function isGitHubRepository(repository: string): boolean {
	return /^https:\/\/github\.com\/|^git@github\.com:/.test(repository || '');
}

function isGitHubBadge(href: string): boolean {
	return /^https:\/\/github\.com\/[^/]+\/[^/]+\/workflows\/.*badge\.svg/.test(href || '');
}

function isHostTrusted(url: url.UrlWithStringQuery): boolean {
	return TrustedSVGSources.indexOf(url.host.toLowerCase()) > -1 || isGitHubBadge(url.href);
}

export class ManifestProcessor extends BaseProcessor {
	constructor(manifest: Manifest) {
		super(manifest);

		const flags = ['Public'];

		if (manifest.preview) {
			flags.push('Preview');
		}

		const repository = getRepositoryUrl(manifest.repository);
		const isGitHub = isGitHubRepository(repository);

		let enableMarketplaceQnA: boolean | undefined;
		let customerQnALink: string | undefined;

		if (manifest.qna === 'marketplace') {
			enableMarketplaceQnA = true;
		} else if (typeof manifest.qna === 'string') {
			customerQnALink = manifest.qna;
		} else if (manifest.qna === false) {
			enableMarketplaceQnA = false;
		}

		const extensionKind = getExtensionKind(manifest);

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
				homepage: manifest.homepage,
			},
			galleryBanner: manifest.galleryBanner || {},
			badges: manifest.badges,
			githubMarkdown: manifest.markdown !== 'standard',
			enableMarketplaceQnA,
			customerQnALink,
			extensionDependencies: _(manifest.extensionDependencies || [])
				.uniq()
				.join(','),
			extensionPack: _(manifest.extensionPack || [])
				.uniq()
				.join(','),
			extensionKind: extensionKind.join(','),
			localizedLanguages:
				manifest.contributes && manifest.contributes.localizations
					? manifest.contributes.localizations
							.map(loc => loc.localizedLanguageName || loc.languageName || loc.languageId)
							.join(',')
					: '',
		};

		if (isGitHub) {
			this.vsix.links.github = repository;
		}
	}

	async onFile(file: IFile): Promise<IFile> {
		const path = util.normalize(file.path);

		if (!/^extension\/package.json$/i.test(path)) {
			return Promise.resolve(file);
		}

		// Ensure that package.json is writable as VS Code needs to
		// store metadata in the extracted file.
		return { ...file, mode: 0o100644 };
	}

	async onEnd(): Promise<void> {
		if (typeof this.manifest.extensionKind === 'string') {
			util.log.warn(
				`The 'extensionKind' property should be of type 'string[]'. Learn more at: https://aka.ms/vscode/api/incorrect-execution-location`
			);
		}

		if (this.manifest.publisher === 'vscode-samples') {
			throw new Error(
				"It's not allowed to use the 'vscode-samples' publisher. Learn more at: https://code.visualstudio.com/api/working-with-extensions/publishing-extension."
			);
		}

		if (!this.manifest.repository) {
			util.log.warn(`A 'repository' field is missing from the 'package.json' manifest file.`);

			if (!/^y$/i.test(await util.read('Do you want to continue? [y/N] '))) {
				throw new Error('Aborted');
			}
		}
	}
}

export class TagsProcessor extends BaseProcessor {
	private static Keywords = {
		git: ['git'],
		npm: ['node'],
		spell: ['markdown'],
		bootstrap: ['bootstrap'],
		lint: ['linters'],
		linting: ['linters'],
		react: ['javascript'],
		js: ['javascript'],
		node: ['javascript', 'node'],
		'c++': ['c++'],
		Cplusplus: ['c++'],
		xml: ['xml'],
		angular: ['javascript'],
		jquery: ['javascript'],
		php: ['php'],
		python: ['python'],
		latex: ['latex'],
		ruby: ['ruby'],
		java: ['java'],
		erlang: ['erlang'],
		sql: ['sql'],
		nodejs: ['node'],
		'c#': ['c#'],
		css: ['css'],
		javascript: ['javascript'],
		ftp: ['ftp'],
		haskell: ['haskell'],
		unity: ['unity'],
		terminal: ['terminal'],
		powershell: ['powershell'],
		laravel: ['laravel'],
		meteor: ['meteor'],
		emmet: ['emmet'],
		eslint: ['linters'],
		tfs: ['tfs'],
		rust: ['rust'],
	};

	onEnd(): Promise<void> {
		const keywords = this.manifest.keywords || [];
		const contributes = this.manifest.contributes;
		const activationEvents = this.manifest.activationEvents || [];
		const doesContribute = name => contributes && contributes[name] && contributes[name].length > 0;

		const colorThemes = doesContribute('themes') ? ['theme', 'color-theme'] : [];
		const iconThemes = doesContribute('iconThemes') ? ['theme', 'icon-theme'] : [];
		const productIconThemes = doesContribute('productIconThemes') ? ['theme', 'product-icon-theme'] : [];
		const snippets = doesContribute('snippets') ? ['snippet'] : [];
		const keybindings = doesContribute('keybindings') ? ['keybindings'] : [];
		const debuggers = doesContribute('debuggers') ? ['debuggers'] : [];
		const json = doesContribute('jsonValidation') ? ['json'] : [];

		const localizationContributions = ((contributes && contributes['localizations']) || []).reduce(
			(r, l) => [...r, `lp-${l.languageId}`, ...toLanguagePackTags(l.translations, l.languageId)],
			[]
		);

		const languageContributions = ((contributes && contributes['languages']) || []).reduce(
			(r, l) => [...r, l.id, ...(l.aliases || []), ...toExtensionTags(l.extensions || [])],
			[]
		);

		const languageActivations = activationEvents
			.map(e => /^onLanguage:(.*)$/.exec(e))
			.filter(r => !!r)
			.map(r => r[1]);

		const grammars = ((contributes && contributes['grammars']) || []).map(g => g.language);

		const description = this.manifest.description || '';
		const descriptionKeywords = Object.keys(TagsProcessor.Keywords).reduce(
			(r, k) =>
				r.concat(
					new RegExp('\\b(?:' + escapeRegExp(k) + ')(?!\\w)', 'gi').test(description) ? TagsProcessor.Keywords[k] : []
				),
			[]
		);

		const tags = [
			...keywords,
			...colorThemes,
			...iconThemes,
			...productIconThemes,
			...snippets,
			...keybindings,
			...debuggers,
			...json,
			...localizationContributions,
			...languageContributions,
			...languageActivations,
			...grammars,
			...descriptionKeywords,
		];

		this.tags = _(tags)
			.uniq() // deduplicate
			.compact() // remove falsey values
			.value();

		return Promise.resolve(null);
	}
}

export class MarkdownProcessor extends BaseProcessor {
	private baseContentUrl: string;
	private baseImagesUrl: string;
	private isGitHub: boolean;
	private repositoryUrl: string;
	private gitHubIssueLinking: boolean;

	constructor(
		manifest: Manifest,
		private name: string,
		private regexp: RegExp,
		private assetType: string,
		options: IPackageOptions = {}
	) {
		super(manifest);

		const guess = this.guessBaseUrls(options.githubBranch);

		this.baseContentUrl = options.baseContentUrl || (guess && guess.content);
		this.baseImagesUrl = options.baseImagesUrl || options.baseContentUrl || (guess && guess.images);
		this.repositoryUrl = guess && guess.repository;
		this.isGitHub = isGitHubRepository(this.repositoryUrl);
		this.gitHubIssueLinking = typeof options.gitHubIssueLinking === 'boolean' ? options.gitHubIssueLinking : true;
	}

	async onFile(file: IFile): Promise<IFile> {
		const path = util.normalize(file.path);

		if (!this.regexp.test(path)) {
			return Promise.resolve(file);
		}

		this.assets.push({ type: this.assetType, path });

		let contents = await read(file);

		if (/This is the README for your extension /.test(contents)) {
			throw new Error(`Make sure to edit the README.md file before you package or publish your extension.`);
		}

		const markdownPathRegex = /(!?)\[([^\]\[]*|!\[[^\]\[]*]\([^\)]+\))\]\(([^\)]+)\)/g;
		const urlReplace = (_, isImage, title, link: string) => {
			if (/^mailto:/i.test(link)) {
				return `${isImage}[${title}](${link})`;
			}

			const isLinkRelative = !/^\w+:\/\//.test(link) && link[0] !== '#';

			if (!this.baseContentUrl && !this.baseImagesUrl) {
				const asset = isImage ? 'image' : 'link';

				if (isLinkRelative) {
					throw new Error(
						`Couldn't detect the repository where this extension is published. The ${asset} '${link}' will be broken in ${this.name}. GitHub repositories will be automatically detected. Otherwise, please provide the repository URL in package.json or use the --baseContentUrl and --baseImagesUrl options.`
					);
				}
			}

			title = title.replace(markdownPathRegex, urlReplace);
			const prefix = isImage ? this.baseImagesUrl : this.baseContentUrl;

			if (!prefix || !isLinkRelative) {
				return `${isImage}[${title}](${link})`;
			}

			return `${isImage}[${title}](${urljoin(prefix, link)})`;
		};

		// Replace Markdown links with urls
		contents = contents.replace(markdownPathRegex, urlReplace);

		// Replace <img> links with urls
		contents = contents.replace(/<img.+?src=["']([/.\w\s-]+)['"].*?>/g, (all, link) => {
			const isLinkRelative = !/^\w+:\/\//.test(link) && link[0] !== '#';

			if (!this.baseImagesUrl && isLinkRelative) {
				throw new Error(
					`Couldn't detect the repository where this extension is published. The image will be broken in ${this.name}. GitHub repositories will be automatically detected. Otherwise, please provide the repository URL in package.json or use the --baseContentUrl and --baseImagesUrl options.`
				);
			}
			const prefix = this.baseImagesUrl;

			if (!prefix || !isLinkRelative) {
				return all;
			}

			return all.replace(link, urljoin(prefix, link));
		});

		if (this.gitHubIssueLinking && this.isGitHub) {
			const markdownIssueRegex = /(\s|\n)([\w\d_-]+\/[\w\d_-]+)?#(\d+)\b/g;
			const issueReplace = (
				all: string,
				prefix: string,
				ownerAndRepositoryName: string,
				issueNumber: string
			): string => {
				let result = all;
				let owner: string;
				let repositoryName: string;

				if (ownerAndRepositoryName) {
					[owner, repositoryName] = ownerAndRepositoryName.split('/', 2);
				}

				if (owner && repositoryName && issueNumber) {
					// Issue in external repository
					const issueUrl = urljoin('https://github.com', owner, repositoryName, 'issues', issueNumber);
					result = prefix + `[${owner}/${repositoryName}#${issueNumber}](${issueUrl})`;
				} else if (!owner && !repositoryName && issueNumber) {
					// Issue in own repository
					result = prefix + `[#${issueNumber}](${urljoin(this.repositoryUrl, 'issues', issueNumber)})`;
				}

				return result;
			};
			// Replace Markdown issue references with urls
			contents = contents.replace(markdownIssueRegex, issueReplace);
		}

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

			if (/\.svg$/i.test(srcUrl.pathname) && !isHostTrusted(srcUrl)) {
				throw new Error(
					`SVGs are restricted in ${this.name}; please use other file image formats, such as PNG: ${src}`
				);
			}
		});

		$('svg').each(() => {
			throw new Error(`SVG tags are not allowed in ${this.name}.`);
		});

		return {
			path: file.path,
			contents: Buffer.from(contents, 'utf8'),
		};
	}

	// GitHub heuristics
	private guessBaseUrls(githubBranch: string | undefined): { content: string; images: string; repository: string } {
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
		const branchName = githubBranch ? githubBranch : 'HEAD';

		return {
			content: `https://github.com/${account}/${repositoryName}/blob/${branchName}`,
			images: `https://github.com/${account}/${repositoryName}/raw/${branchName}`,
			repository: `https://github.com/${account}/${repositoryName}`,
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
		super(
			manifest,
			'CHANGELOG.md',
			/^extension\/changelog.md$/i,
			'Microsoft.VisualStudio.Services.Content.Changelog',
			options
		);
	}
}

class LicenseProcessor extends BaseProcessor {
	private didFindLicense = false;
	filter: (name: string) => boolean;

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

export function isSupportedWebExtension(manifest: Manifest, extensionsReport: IExtensionsReport): boolean {
	const id = `${manifest.publisher}.${manifest.name}`;
	return (
		extensionsReport.web.publishers.some(publisher => manifest.publisher === publisher) ||
		extensionsReport.web.extensions.some(extension => extension === id)
	);
}

export function isWebKind(manifest: Manifest): boolean {
	const extensionKind = getExtensionKind(manifest);
	return extensionKind.some(kind => kind === 'web');
}

const workspaceExtensionPoints: string[] = ['terminal', 'debuggers', 'jsonValidation'];

function getExtensionKind(manifest: Manifest): ExtensionKind[] {
	// check the manifest
	if (manifest.extensionKind) {
		return Array.isArray(manifest.extensionKind)
			? manifest.extensionKind
			: manifest.extensionKind === 'ui'
			? ['ui', 'workspace']
			: [manifest.extensionKind];
	}

	// Not an UI extension if it has main
	if (manifest.main) {
		if (manifest.browser) {
			return ['workspace', 'web'];
		}
		return ['workspace'];
	}

	if (manifest.browser) {
		return ['web'];
	}

	const isNonEmptyArray = obj => Array.isArray(obj) && obj.length > 0;
	// Not an UI nor web extension if it has dependencies or an extension pack
	if (isNonEmptyArray(manifest.extensionDependencies) || isNonEmptyArray(manifest.extensionPack)) {
		return ['workspace'];
	}

	if (manifest.contributes) {
		// Not an UI nor web extension if it has workspace contributions
		for (const contribution of Object.keys(manifest.contributes)) {
			if (workspaceExtensionPoints.indexOf(contribution) !== -1) {
				return ['workspace'];
			}
		}
	}

	return ['ui', 'workspace', 'web'];
}

export class WebExtensionProcessor extends BaseProcessor {
	private readonly isWebKind: boolean = false;

	constructor(manifest: Manifest, options: IPackageOptions) {
		super(manifest);
		this.isWebKind = options.web && isWebKind(manifest);
	}

	onFile(file: IFile): Promise<IFile> {
		if (this.isWebKind) {
			const path = util.normalize(file.path);
			if (/\.svg$/i.test(path)) {
				throw new Error(`SVGs can't be used in a web extension: ${path}`);
			}
			this.assets.push({ type: `Microsoft.VisualStudio.Code.WebResources/${path}`, path });
		}
		return Promise.resolve(file);
	}

	async onEnd(): Promise<void> {
		if (this.assets.length > 25) {
			throw new Error(
				'Cannot pack more than 25 files in a web extension. Use `vsce ls` to see all the files that will be packed and exclude those which are not needed in .vscodeignore.'
			);
		}
		if (this.isWebKind) {
			this.vsix = {
				...this.vsix,
				webExtension: true,
			};
			this.tags = ['__web_extension'];
		}
	}
}

export class NLSProcessor extends BaseProcessor {
	private translations: { [path: string]: string } = Object.create(null);

	constructor(manifest: Manifest) {
		super(manifest);

		if (
			!manifest.contributes ||
			!manifest.contributes.localizations ||
			manifest.contributes.localizations.length === 0
		) {
			return;
		}

		const localizations = manifest.contributes.localizations;
		const translations: { [languageId: string]: string } = Object.create(null);

		// take last reference in the manifest for any given language
		for (const localization of localizations) {
			for (const translation of localization.translations) {
				if (translation.id === 'vscode' && !!translation.path) {
					const translationPath = util.normalize(translation.path.replace(/^\.[\/\\]/, ''));
					translations[localization.languageId.toUpperCase()] = `extension/${translationPath}`;
				}
			}
		}

		// invert the map for later easier retrieval
		for (const languageId of Object.keys(translations)) {
			this.translations[translations[languageId]] = languageId;
		}
	}

	onFile(file: IFile): Promise<IFile> {
		const normalizedPath = util.normalize(file.path);
		const language = this.translations[normalizedPath];

		if (language) {
			this.assets.push({ type: `Microsoft.VisualStudio.Code.Translation.${language}`, path: normalizedPath });
		}

		return Promise.resolve(file);
	}
}

export class ValidationProcessor extends BaseProcessor {
	private files = new Map<string, string[]>();
	private duplicates = new Set<string>();

	async onFile(file: IFile): Promise<IFile> {
		const lower = file.path.toLowerCase();
		const existing = this.files.get(lower);

		if (existing) {
			this.duplicates.add(lower);
			existing.push(file.path);
		} else {
			this.files.set(lower, [file.path]);
		}

		return file;
	}

	async onEnd() {
		if (this.duplicates.size === 0) {
			return;
		}

		const messages = [
			`The following files have the same case insensitive path, which isn't supported by the VSIX format:`,
		];

		for (const lower of this.duplicates) {
			for (const filePath of this.files.get(lower)) {
				messages.push(`  - ${filePath}`);
			}
		}

		throw new Error(messages.join('\n'));
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

	const hasActivationEvents = !!manifest.activationEvents;
	const hasMain = !!manifest.main;
	const hasBrowser = !!manifest.browser;

	if (hasActivationEvents) {
		if (!hasMain && !hasBrowser) {
			throw new Error(
				"Manifest needs either a 'main' or 'browser' property, given it has a 'activationEvents' property."
			);
		}
	} else if (hasMain) {
		throw new Error("Manifest needs the 'activationEvents' property, given it has a 'main' property.");
	} else if (hasBrowser) {
		throw new Error("Manifest needs the 'activationEvents' property, given it has a 'browser' property.");
	}

	if (manifest.devDependencies && manifest.devDependencies['@types/vscode']) {
		validateVSCodeTypesCompatibility(manifest.engines['vscode'], manifest.devDependencies['@types/vscode']);
	}

	if (/\.svg$/i.test(manifest.icon || '')) {
		throw new Error(`SVGs can't be used as icons: ${manifest.icon}`);
	}

	(manifest.badges || []).forEach(badge => {
		const decodedUrl = decodeURI(badge.url);
		const srcUrl = url.parse(decodedUrl);

		if (!/^https:$/i.test(srcUrl.protocol)) {
			throw new Error(`Badge URLs must come from an HTTPS source: ${badge.url}`);
		}

		if (/\.svg$/i.test(srcUrl.pathname) && !isHostTrusted(srcUrl)) {
			throw new Error(`Badge SVGs are restricted. Please use other file image formats, such as PNG: ${badge.url}`);
		}
	});

	Object.keys(manifest.dependencies || {}).forEach(dep => {
		if (dep === 'vscode') {
			throw new Error(
				`You should not depend on 'vscode' in your 'dependencies'. Did you mean to add it to 'devDependencies'?`
			);
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
		.catch<string>(err => (err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve('{}')))
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

export function toVsixManifest(vsix: any): Promise<string> {
	return readFile(vsixManifestTemplatePath, 'utf8')
		.then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
		.then(vsixManifestTemplate => vsixManifestTemplate(vsix));
}

const defaultExtensions = {
	'.json': 'application/json',
	'.vsixmanifest': 'text/xml',
};

export function toContentTypes(files: IFile[]): Promise<string> {
	const extensions = Object.keys(_.keyBy(files, f => path.extname(f.path).toLowerCase()))
		.filter(e => !!e)
		.reduce((r, e) => ({ ...r, [e]: lookup(e) }), {});

	const allExtensions = { ...extensions, ...defaultExtensions };
	const contentTypes = Object.keys(allExtensions).map(extension => ({
		extension,
		contentType: allExtensions[extension],
	}));

	return readFile(contentTypesTemplatePath, 'utf8')
		.then(contentTypesTemplateStr => _.template(contentTypesTemplateStr))
		.then(contentTypesTemplate => contentTypesTemplate({ contentTypes }));
}

const defaultIgnore = [
	'.vscodeignore',
	'package-lock.json',
	'yarn.lock',
	'npm-shrinkwrap.json',
	'.editorconfig',
	'.npmrc',
	'.yarnrc',
	'.gitattributes',
	'*.todo',
	'tslint.yaml',
	'.eslintrc*',
	'.babelrc*',
	'.prettierrc',
	'webpack.config.js',
	'ISSUE_TEMPLATE.md',
	'CONTRIBUTING.md',
	'PULL_REQUEST_TEMPLATE.md',
	'CODE_OF_CONDUCT.md',
	'.github',
	'.travis.yml',
	'appveyor.yml',
	'**/.git/**',
	'**/*.vsix',
	'**/.DS_Store',
	'**/*.vsixmanifest',
	'**/.vscode-test/**',
];

const notIgnored = ['!package.json', '!README.md'];

function collectAllFiles(cwd: string, useYarn?: boolean, dependencyEntryPoints?: string[]): Promise<string[]> {
	return getDependencies(cwd, useYarn, dependencyEntryPoints).then(deps => {
		const promises: Promise<string[]>[] = deps.map(dep => {
			return glob('**', { cwd: dep, nodir: true, dot: true, ignore: 'node_modules/**' }).then(files =>
				files.map(f => path.relative(cwd, path.join(dep, f))).map(f => f.replace(/\\/g, '/'))
			);
		});

		return Promise.all(promises).then(util.flatten);
	});
}

function collectFiles(
	cwd: string,
	useYarn?: boolean,
	dependencyEntryPoints?: string[],
	ignoreFile?: string
): Promise<string[]> {
	return collectAllFiles(cwd, useYarn, dependencyEntryPoints).then(files => {
		files = files.filter(f => !/\r$/m.test(f));

		return (
			readFile(ignoreFile ? ignoreFile : path.join(cwd, '.vscodeignore'), 'utf8')
				.catch<string>(err =>
					err.code !== 'ENOENT' ? Promise.reject(err) : ignoreFile ? Promise.reject(err) : Promise.resolve('')
				)

				// Parse raw ignore by splitting output into lines and filtering out empty lines and comments
				.then(rawIgnore =>
					rawIgnore
						.split(/[\n\r]/)
						.map(s => s.trim())
						.filter(s => !!s)
						.filter(i => !/^\s*#/.test(i))
				)

				// Add '/**' to possible folder names
				.then(ignore => [
					...ignore,
					...ignore.filter(i => !/(^|\/)[^/]*\*[^/]*$/.test(i)).map(i => (/\/$/.test(i) ? `${i}**` : `${i}/**`)),
				])

				// Combine with default ignore list
				.then(ignore => [...defaultIgnore, ...ignore, ...notIgnored])

				// Split into ignore and negate list
				.then(ignore => _.partition(ignore, i => !/^\s*!/.test(i)))
				.then(r => ({ ignore: r[0], negate: r[1] }))

				// Filter out files
				.then(({ ignore, negate }) =>
					files.filter(
						f =>
							!ignore.some(i => minimatch(f, i, MinimatchOptions)) ||
							negate.some(i => minimatch(f, i.substr(1), MinimatchOptions))
					)
				)
		);
	});
}

export function processFiles(processors: IProcessor[], files: IFile[]): Promise<IFile[]> {
	const processedFiles = files.map(file => util.chain(file, processors, (file, processor) => processor.onFile(file)));

	return Promise.all(processedFiles).then(files => {
		return util.sequence(processors.map(p => () => p.onEnd())).then(() => {
			const assets = _.flatten(processors.map(p => p.assets));
			const tags = _(_.flatten(processors.map(p => p.tags)))
				.uniq() // deduplicate
				.compact() // remove falsey values
				.join(',');
			const vsix = processors.reduce((r, p) => ({ ...r, ...p.vsix }), { assets, tags });

			return Promise.all([toVsixManifest(vsix), toContentTypes(files)]).then(result => {
				return [
					{ path: 'extension.vsixmanifest', contents: Buffer.from(result[0], 'utf8') },
					{ path: '[Content_Types].xml', contents: Buffer.from(result[1], 'utf8') },
					...files,
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
		new IconProcessor(manifest),
		new NLSProcessor(manifest),
		new WebExtensionProcessor(manifest, options),
		new ValidationProcessor(manifest),
	];
}

export function collect(manifest: Manifest, options: IPackageOptions = {}): Promise<IFile[]> {
	const cwd = options.cwd || process.cwd();
	const packagedDependencies = options.dependencyEntryPoints || undefined;
	const ignoreFile = options.ignoreFile || undefined;
	const processors = createDefaultProcessors(manifest, options);

	return collectFiles(cwd, options.useYarn, packagedDependencies, ignoreFile).then(fileNames => {
		const files = fileNames.map(f => ({ path: `extension/${f}`, localPath: path.join(cwd, f) }));

		return processFiles(processors, files);
	});
}

function writeVsix(files: IFile[], packagePath: string): Promise<void> {
	return unlink(packagePath)
		.catch(err => (err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(null)))
		.then(
			() =>
				new Promise((c, e) => {
					const zip = new yazl.ZipFile();
					files.forEach(f =>
						isInMemoryFile(f)
							? zip.addBuffer(typeof f.contents === 'string' ? Buffer.from(f.contents, 'utf8') : f.contents, f.path, {
									mode: f.mode,
							  })
							: zip.addFile(f.localPath, f.path, { mode: f.mode })
					);
					zip.end();

					const zipStream = fs.createWriteStream(packagePath);
					zip.outputStream.pipe(zipStream);

					zip.outputStream.once('error', e);
					zipStream.once('error', e);
					zipStream.once('finish', () => c());
				})
		);
}

function getDefaultPackageName(manifest: Manifest): string {
	return `${manifest.name}-${manifest.version}.vsix`;
}

async function prepublish(cwd: string, manifest: Manifest, useYarn?: boolean): Promise<void> {
	if (!manifest.scripts || !manifest.scripts['vscode:prepublish']) {
		return;
	}

	if (useYarn === undefined) {
		useYarn = await detectYarn(cwd);
	}

	console.log(`Executing prepublish script '${useYarn ? 'yarn' : 'npm'} run vscode:prepublish'...`);

	await new Promise<void>((c, e) => {
		const tool = useYarn ? 'yarn' : 'npm';
		const child = cp.spawn(tool, ['run', 'vscode:prepublish'], { cwd, shell: true, stdio: 'inherit' });
		child.on('exit', code => (code === 0 ? c() : e(`${tool} failed with exit code ${code}`)));
		child.on('error', e);
	});
}

async function getPackagePath(cwd: string, manifest: Manifest, options: IPackageOptions = {}): Promise<string> {
	if (!options.packagePath) {
		return path.join(cwd, getDefaultPackageName(manifest));
	}

	try {
		const _stat = await stat(options.packagePath);

		if (_stat.isDirectory()) {
			return path.join(options.packagePath, getDefaultPackageName(manifest));
		} else {
			return options.packagePath;
		}
	} catch {
		return options.packagePath;
	}
}

export async function pack(options: IPackageOptions = {}): Promise<IPackageResult> {
	const cwd = options.cwd || process.cwd();

	const manifest = await readManifest(cwd);

	await prepublish(cwd, manifest, options.useYarn);

	const files = await collect(manifest, options);
	const jsFiles = files.filter(f => /\.js$/i.test(f.path));

	if (files.length > 5000 || jsFiles.length > 100) {
		console.log(
			`This extension consists of ${files.length} files, out of which ${jsFiles.length} are JavaScript files. For performance reasons, you should bundle your extension: https://aka.ms/vscode-bundle-extension . You should also exclude unnecessary files by adding them to your .vscodeignore: https://aka.ms/vscode-vscodeignore`
		);
	}

	const packagePath = await getPackagePath(cwd, manifest, options);
	await writeVsix(files, path.resolve(packagePath));

	return { manifest, packagePath, files };
}

export async function packageCommand(options: IPackageOptions = {}): Promise<any> {
	const { packagePath, files } = await pack(options);
	const stats = await stat(packagePath);

	let size = 0;
	let unit = '';

	if (stats.size > 1048576) {
		size = Math.round(stats.size / 10485.76) / 100;
		unit = 'MB';
	} else {
		size = Math.round(stats.size / 10.24) / 100;
		unit = 'KB';
	}

	util.log.done(`Packaged: ${packagePath} (${files.length} files, ${size}${unit})`);
}

/**
 * Lists the files included in the extension's package. Does not run prepublish.
 */
export async function listFiles(
	cwd = process.cwd(),
	useYarn?: boolean,
	packagedDependencies?: string[],
	ignoreFile?: string
): Promise<string[]> {
	await readManifest(cwd);
	return await collectFiles(cwd, useYarn, packagedDependencies, ignoreFile);
}

/**
 * Lists the files included in the extension's package. Runs prepublish.
 */
export function ls(
	cwd = process.cwd(),
	useYarn?: boolean,
	packagedDependencies?: string[],
	ignoreFile?: string
): Promise<void> {
	return readManifest(cwd)
		.then(manifest => prepublish(cwd, manifest, useYarn))
		.then(() => collectFiles(cwd, useYarn, packagedDependencies, ignoreFile))
		.then(files => files.forEach(f => console.log(`${f}`)));
}
