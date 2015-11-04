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

interface IReadFile {
	(filePath: string): Promise<Buffer>;
	(filePath: string, encoding?: string): Promise<string>;
}

const readFile: IReadFile = <any> denodeify(fs.readFile);
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

export function read(file: IFile): Promise<Buffer> {
	if (file.contents) {
		return Promise.resolve(file.contents);
	} else {
		return readFile(file.localPath);
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
}

export interface IProcessor {
	onFile(file: IFile): Promise<IFile>;
	assets: IAsset[];
	vsix: any;
}

export abstract class BaseProcessor implements IProcessor {
	constructor(protected manifest: Manifest) {}
	public assets: IAsset[] = [];
	public vsix: any = Object.create(null);
	abstract onFile(file: IFile): Promise<IFile>;
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

class MainProcessor extends BaseProcessor {
	constructor(manifest: Manifest) {
		super(manifest);

		_.assign(this.vsix, {
			id: manifest.name,
			displayName: manifest.displayName || manifest.name,
			version: manifest.version,
			publisher: manifest.publisher,
			description: manifest.description || '',
			tags: (manifest.keywords || []).concat('vscode').join(','),
			categories: (manifest.categories || []).join(','),
			links: {
				repository: getUrl(manifest.repository),
				bugs: getUrl(manifest.bugs),
				homepage: manifest.homepage
			},
			galleryBanner: manifest.galleryBanner || {}
		});
	}
	onFile(file: IFile): Promise<IFile> {
		return Promise.resolve(file);
	}
}

export class ReadmeProcessor extends BaseProcessor {
	
	private baseContentUrl: string;
	
	constructor(manifest: Manifest, options: IPackageOptions= {}) {
		super(manifest);
		this.baseContentUrl = options.baseContentUrl || this.guessBaseContentUrl();
	}
	
	onFile(file: IFile): Promise<IFile> {
		const path = util.normalize(file.path);
		
		if (/^extension\/readme.md$/i.test(path)) {
			this.assets.push({ type: 'Microsoft.VisualStudio.Services.Content.Details', path });
			
			if (this.baseContentUrl) {
				return read(file)
					.then(buffer => buffer.toString('utf8'))
					.then(contents => contents.replace(/\[([^\[]+)\]\(([^\)]+)\)/g, (all, title, link) =>
						all.substr(0, title.length) + all.substr(title.length).replace(link, this.prependBaseContentUrl(link))
					))
					.then(contents => ({
						path: file.path,
						contents: new Buffer(contents)
					}));
			}
		}
		
		return Promise.resolve(file);
	}
	
	private prependBaseContentUrl(link: string): string {
		if (/^(?:\w+:)\/\//.test(link)) {
			return link;
		}
		
		if (link[0] === '#') {
			return link;
		}
		
		return urljoin(this.baseContentUrl, link);
	}
	
	// GitHub heuristics
	private guessBaseContentUrl(): string {
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
		
		if (match) {
			const account = match[1];
			const repository = match[2].replace(/\.git$/i, '');
			return `https://github.com/${ account }/${ repository }/raw/master`;
		}
	}
}

class LicenseProcessor extends BaseProcessor {

	private filter: (name: string) => boolean;

	constructor(manifest: Manifest) {
		super(manifest);

		const match = /^SEE LICENSE IN (.*)$/.exec(manifest.license || '');

		if (!match || !match[1]) {
			this.filter = () => false;
		} else {
			const regexp = new RegExp('^extension/' + match[1] + '$');
			this.filter = regexp.test.bind(regexp);
		}

		this.vsix.license = null;
	}

	onFile(file: IFile): Promise<IFile> {
		const normalizedPath = util.normalize(file.path);
		if (this.filter(normalizedPath)) {
			this.assets.push({ type: 'Microsoft.VisualStudio.Services.Content.License', path: normalizedPath });
			this.vsix.license = normalizedPath;
		}
		return Promise.resolve(file);
	}
}

class IconProcessor extends BaseProcessor {

	private icon: string;

	constructor(manifest: Manifest) {
		super(manifest);

		this.icon = manifest.icon ? `extension/${ manifest.icon }` : null;
		this.vsix.icon = null;
	}

	onFile(file: IFile): Promise<IFile> {
		const normalizedPath = util.normalize(file.path);
		if (normalizedPath === this.icon) {
			this.assets.push({ type: 'Microsoft.VisualStudio.Services.Icons.Default', path: normalizedPath });
			this.vsix.icon = this.icon;
		}
		return Promise.resolve(file);
	}
}

export function readManifest(cwd: string): Promise<Manifest> {
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
		.then(manifest => {
			if (!manifest.publisher) {
				return Promise.reject('Manifest missing field: publisher');
			}

			if (!manifest.name) {
				return Promise.reject('Manifest missing field: name');
			}

			if (!manifest.version) {
				return Promise.reject('Manifest missing field: version');
			}

			if (!manifest.engines) {
				return Promise.reject('Manifest missing field: engines');
			}

			if (!manifest.engines['vscode']) {
				return Promise.reject('Manifest missing field: engines.vscode');
			}

			return Promise.resolve(manifest);
		});
}

export function toVsixManifest(manifest: Manifest, files: IFile[], options: IPackageOptions = {}): Promise<string> {
	const processors: IProcessor[] = [
		new MainProcessor(manifest),
		new ReadmeProcessor(manifest, options),
		new LicenseProcessor(manifest),
		new IconProcessor(manifest)
	];

	return Promise.all(files.map(file => util.chain(file, processors, (file, processor) => processor.onFile(file))))
	.then(files => {
		const assets = _.flatten(processors.map(p => p.assets));
		const vsix = (<any> _.assign)({ assets }, ...processors.map(p => p.vsix));
	
		return readFile(vsixManifestTemplatePath, 'utf8')
			.then(vsixManifestTemplateStr => _.template(vsixManifestTemplateStr))
			.then(vsixManifestTemplate => vsixManifestTemplate(vsix));
	});
}

export function toContentTypes(files: IFile[]): Promise<string> {
	const extensions = Object.keys(_.indexBy(files, f => path.extname(f.path)))
		.map(e => e.toLowerCase())
		.filter(e => e && !_.contains(['.json', '.vsixmanifest'], e));

	const contentTypes = extensions
		.map(extension => ({ extension, contentType: mime.lookup(extension) }));

	return readFile(contentTypesTemplatePath, 'utf8')
		.then(contentTypesTemplateStr => _.template(contentTypesTemplateStr))
		.then(contentTypesTemplate => contentTypesTemplate({ contentTypes }));
}

const defaultIgnore = [
	'.vscodeignore',
	'**/.git/**',
	'**/*.vsix',
	'**/.DS_Store'
];

function devDependenciesIgnore(manifest: Manifest): string[] {
	const devDependencies = Object.keys(manifest.devDependencies || {});
	return devDependencies.map(d => `node_modules/${ d }/**`);
}

function collectFiles(cwd: string, manifest: Manifest): Promise<string[]> {
	return glob('**', { cwd, nodir: true, dot: true }).then(files => {
		return readFile(path.join(cwd, '.vscodeignore'), 'utf8')
			.catch<string>(err => err.code !== 'ENOENT' ? Promise.reject(err) : Promise.resolve(''))
			.then(rawIgnore => rawIgnore.split(/[\n\r]/).map(s => s.trim()).filter(s => !!s))
			.then(ignore => devDependenciesIgnore(manifest).concat(ignore))
			.then(ignore => defaultIgnore.concat(ignore))
			.then(ignore => ignore.filter(i => !/^\s*#/.test(i)))
			.then<{ ignore: string[]; negate: string[]; }>(ignore => <any> _.indexBy(_.partition(ignore, i => !/^\s*!/.test(i)), (o, i) => i ? 'negate' : 'ignore'))
			.then(({ ignore, negate }) => files.filter(f => !ignore.some(i => minimatch(f, i, MinimatchOptions)) || negate.some(i => minimatch(f, i.substr(1), MinimatchOptions))));
	});
}

export function collect(manifest: Manifest, options: IPackageOptions = {}): Promise<IFile[]> {
	const cwd = options.cwd || process.cwd();
	
	return collectFiles(cwd, manifest).then(fileNames => {
		const files:IFile[] = fileNames.map(f => ({ path: `extension/${ f }`, localPath: path.join(cwd, f) }));

		return Promise.all([toVsixManifest(manifest, files, options), toContentTypes(files)])
			.then(result => {
				return [
					{ path: 'extension.vsixmanifest', contents: new Buffer(result[0], 'utf8') },
					{ path: '[Content_Types].xml', contents: new Buffer(result[1], 'utf8') },
					...files
				];
			});
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
