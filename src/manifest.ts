export interface Person {
	name: string;
	url?: string;
	email?: string;
}

export interface Translation {
	id: string;
	path: string;
}

export interface Localization {
	languageId: string;
	languageName?: string;
	localizedLanguageName?: string;
	translations: Translation[];
}

export interface Contributions {
	'localizations'?: Localization[];
	[contributionType: string]: any;
}

export interface Manifest {
	// mandatory (npm)
	name: string;
	version: string;
	engines: { [name: string]: string; };

	// vscode
	publisher: string;
	icon?: string;
	contributes?: Contributions;
	activationEvents?: string[];
	extensionDependencies?: string[];
	extensionPack?: string[];
	galleryBanner?: { color?: string; theme?: string; };
	preview?: boolean;
	badges?: { url: string; href: string; description: string; }[];
	markdown?: 'github' | 'standard';
	_bundling?: { [name: string]: string; }[];
	_testing?: string;
	enableProposedApi?: boolean;
	qna?: 'marketplace' | string | false;
	extensionKind?: string[];

	// optional (npm)
	author?: string | Person;
	displayName?: string;
	description?: string;
	keywords?: string[];
	categories?: string[];
	homepage?: string;
	bugs?: string | { url?: string; email?: string };
	license?: string;
	contributors?: string | Person[];
	main?: string;
	repository?: string | { type?: string; url?: string; };
	scripts?: { [name: string]: string; };
	dependencies?: { [name: string]: string; };
	devDependencies?: { [name: string]: string; };
	private?: boolean;

	// not supported (npm)
	// files?: string[];
	// bin
	// man
	// directories
	// config
	// peerDependencies
	// bundledDependencies
	// optionalDependencies
	// os?: string[];
	// cpu?: string[];
	// preferGlobal
	// publishConfig
}
