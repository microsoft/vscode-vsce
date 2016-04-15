import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as _ from 'lodash';
import * as yazl from 'yazl';
import { Manifest } from './manifest';
import * as util from './util';
import * as _glob from 'glob';
import * as minimatch from 'minimatch';
import * as denodeify from 'denodeify';
import * as mime from 'mime';
import * as urljoin from 'url-join';
import { validatePublisher, validateExtensionName, validateVersion } from './validation';
import { getDependencies } from './npm';

interface IReadFile {
	(filePath: string): Promise<Buffer>;
	(filePath: string, encoding?: string): Promise<string>;
}

const readFile = denodeify<string, string, string>(fs.readFile);
const writeFile = denodeify<string, string, string, void>(fs.writeFile);
const unlink = denodeify<string, void>(fs.unlink);
const exec = denodeify<string, { cwd?: string; }, { stdout: string; stderr: string; }>(cp.exec, (err, stdout, stderr) => [err, { stdout, stderr }]);
const glob = denodeify<string, _glob.IOptions, string[]>(_glob);

const resourcesPath = path.join(path.dirname(__dirname), 'resources');
const vsixManifestTemplatePath = path.join(resourcesPath, 'extension.vsixmanifest');
const contentTypesTemplatePath = path.join(resourcesPath, '[Content_Types].xml');

const MinimatchOptions = { dot: true };

export interface IFile {
	path: string;
	contents?: Buffer;
	localPath?: string;
}

export function read(file: IFile): Promise<string> {
	if (file.contents) {
		return Promise.resolve(file.contents).then(b => b.toString('utf8'));
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
	version?: string;
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
	constructor(protected manifest: Manifest) {}
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
		return <string> url;
	}

	return (<any> url).url;
}

class ManifestProcessor extends BaseProcessor {

	constructor(manifest: Manifest) {
		super(manifest);

		const flags = ['Public'];

		if (manifest.preview) {
			flags.push('Preview');
		}

		_.assign(this.vsix, {
			id: manifest.name,
			displayName: manifest.displayName || manifest.name,
			version: manifest.version,
			publisher: manifest.publisher,
			description: manifest.description || '',
			categories: (manifest.categories || []).join(','),
			flags: flags.join(' '),
			links: {
				repository: getUrl(manifest.repository),
				bugs: getUrl(manifest.bugs),
				homepage: manifest.homepage
			},
			galleryBanner: manifest.galleryBanner || {}
		});
	}
}

export class TagsProcessor extends BaseProcessor {

	onEnd(): Promise<void> {
		const keywords = this.manifest.keywords || [];
		const trimmedKeywords = keywords.slice(0, 5);

		let promise = Promise.resolve(trimmedKeywords);

		if (keywords.length > 5) {
			console.warn(`The keyword list is limited to 5 keywords; only the following keywords will be in your extension: [${ trimmedKeywords.join(', ') }].`);
			promise = util.read('Do you want to continue? [y/N] ')
				.then(answer => /^y$/i.test(answer) ? Promise.resolve(trimmedKeywords) : Promise.reject('Aborted'));
		}

		return promise.then<any>(keywords => {
			const contributes = this.manifest.contributes;
			const themes = contributes && contributes['themes'];

			if (themes && themes.length > 0) {
				keywords = [...keywords, 'theme'];
			}

			this.vsix.tags = _.unique(keywords).join(',');
		});
	}
}

export class ReadmeProcessor extends BaseProcessor {

	private baseContentUrl: string;
	private baseImagesUrl: string;

	constructor(manifest: Manifest, options: IPackageOptions= {}) {
		super(manifest);

		const guess = this.guessBaseUrls();

		this.baseContentUrl = options.baseContentUrl || (guess && guess.content);
		this.baseImagesUrl = options.baseImagesUrl || options.baseContentUrl || (guess && guess.images);
	}

	onFile(file: IFile): Promise<IFile> {
		const path = util.normalize(file.path);

		if (!/^extension\/readme.md$/i.test(path)) {
			return Promise.resolve(file);
		}

		this.assets.push({ type: 'Microsoft.VisualStudio.Services.Content.Details', path });

		if (!this.baseContentUrl && !this.baseImagesUrl) {
			return Promise.resolve(file);
		}

		return read(file)
			.then(contents => contents.replace(/(!?)\[([^\]]+)\]\(([^\)]+)\)/g, (all, isImage, title, link) => {
				const prefix = isImage ? this.baseImagesUrl : this.baseContentUrl;

				if (!prefix || /^\w+:\/\//.test(link) || link[0] === '#') {
					return all;
				}

				return `${ isImage }[${ title }](${ urljoin(prefix, link) })`;
			}))
			.then(contents => ({
				path: file.path,
				contents: new Buffer(contents)
			}));
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
			content: `https://github.com/${ account }/${ repositoryName }/blob/master`,
			images: `https://github.com/${ account }/${ repositoryName }/raw/master`
		};
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

		this.icon = manifest.icon ? `extension/${ manifest.icon }` : null;
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
			return Promise.reject(new Error(`The specified icon '${ this.icon }' wasn't found in the extension.`));
		}

		return Promise.resolve(null);
	}
}

export function validateManifest(manifest: Manifest): Manifest {
	validatePublisher(manifest.publisher);
	validateExtensionName(manifest.name);
  validateVersion(manifest.version);

	if (!manifest.version) {
		throw new Error('Manifest missing field: version');
	}

	if (!manifest.engines) {
		throw new Error('Manifest missing field: engines');
	}

	if (!manifest.engines['vscode']) {
		throw new Error('Manifest missing field: engines.vscode');
	}

	return manifest;
}

export function readManifest(cwd = process.cwd()): Promise<Manifest> {
	const manifestPath = path.join(cwd, 'package.json');

	return readFile(manifestPath, 'utf8')
		.catch(() => Promise.reject(`Extension manifest not found: ${ manifestPath }`))
		.then<Manifest>(manifestStr => {
			try {
				return Promise.resolve(JSON.parse(manifestStr));
			} catch (e) {
				return Promise.reject(`Error parsing manifest file: not a valid JSON file.`);
			}
		})
		.then(validateManifest);
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
	const extensions = Object.keys(_.indexBy(files, f => path.extname(f.path).toLowerCase()))
		.filter(e => !!e)
		.reduce((r, e) => _.assign(r, { [e]: mime.lookup(e) }), {});

	const allExtensions = _.assign({}, extensions, defaultExtensions);
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

function collectFiles(cwd: string, manifest: Manifest): Promise<string[]> {
	return collectAllFiles(cwd).then(files => {
		return readFile(path.join(cwd, '.vscodeignore'), 'utf8')
			.catch<string>(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(''))
			.then(rawIgnore => rawIgnore.split(/[\n\r]/).map(s => s.trim()).filter(s => !!s))
			.then(ignore => defaultIgnore.concat(ignore))
			.then(ignore => ignore.filter(i => !/^\s*#/.test(i)))
			.then<{ ignore: string[]; negate: string[]; }>(ignore => <any> _.indexBy(_.partition(ignore, i => !/^\s*!/.test(i)), (o, i) => i ? 'negate' : 'ignore'))
			.then(({ ignore, negate }) => files.filter(f => !ignore.some(i => minimatch(f, i, MinimatchOptions)) || negate.some(i => minimatch(f, i.substr(1), MinimatchOptions))));
	});
}

export function processFiles(processors: IProcessor[], files: IFile[], options: IPackageOptions = {}): Promise<IFile[]> {
	const processedFiles = files.map(file => util.chain(file, processors, (file, processor) => processor.onFile(file)));

	return Promise.all(processedFiles).then(files => {
		return Promise.all(processors.map(p => p.onEnd())).then(() => {
			const assets = _.flatten(processors.map(p => p.assets));
			const vsix = (<any> _.assign)({ assets }, ...processors.map(p => p.vsix));

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
		new LicenseProcessor(manifest),
		new IconProcessor(manifest)
	];
}

export function collect(manifest: Manifest, options: IPackageOptions = {}): Promise<IFile[]> {
	const cwd = options.cwd || process.cwd();
	const processors = createDefaultProcessors(manifest, options);

	return collectFiles(cwd, manifest).then(fileNames => {
		const files = fileNames.map(f => ({ path: `extension/${ f }`, localPath: path.join(cwd, f) }));

		return processFiles(processors, files, options);
	});
}

function writeVsix(files: IFile[], packagePath: string): Promise<string> {
	return unlink(packagePath)
		.catch(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(null))
		.then(() => new Promise<string>((c, e) => {
			const zip = new yazl.ZipFile();
			files.forEach(f => f.contents ? zip.addBuffer(f.contents, f.path) : zip.addFile(f.localPath, f.path));
			zip.end();

			const zipStream = fs.createWriteStream(packagePath);
			zip.outputStream.pipe(zipStream);

			zip.outputStream.once('error', e);
			zipStream.once('error', e);
			zipStream.once('finish', () => c(packagePath));
		}));
}

function defaultPackagePath(cwd: string, manifest: Manifest): string {
	return path.join(cwd, `${ manifest.name }-${ manifest.version }.vsix`);
}

function prepublish(cwd: string, manifest: Manifest): Promise<Manifest> {
	if (!manifest.scripts || !manifest.scripts['vscode:prepublish']) {
		return Promise.resolve(manifest);
	}

	const script = manifest.scripts['vscode:prepublish'];
	console.warn(`Executing prepublish script '${ script }'...`);

	return exec(script, { cwd })
		.then(({ stdout }) => {
			process.stdout.write(stdout);
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
		.then(({ packagePath }) => console.log(`Created: ${ packagePath }`));
}

export function ls(cwd = process.cwd()): Promise<any> {
	return readManifest(cwd)
		.then(manifest => prepublish(cwd, manifest))
		.then(manifest => collectFiles(cwd, manifest))
		.then(files => files.forEach(f => console.log(`${f}`)));
}
