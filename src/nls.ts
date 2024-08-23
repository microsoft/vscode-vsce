import { ManifestPackage } from './manifest';

export interface ITranslations {
	[key: string]: string;
}

const regex = /^%([\w\d.]+)%$/i;

function createPatcher(translations: ITranslations): <T>(value: T) => T {
	return <T>(value: T): T => {
		if (typeof value !== 'string') {
			return value;
		}

		const match = regex.exec(value);

		if (!match) {
			return value;
		}

		const translation = translations[match[1]] as unknown;
		if (translation === undefined) {
			throw new Error(`No translation found for ${value}`);
		}

		return translation as T;
	};
}

export function patchNLS(manifest: ManifestPackage, translations: ITranslations): ManifestPackage {
	const patcher = createPatcher(translations);
	return JSON.parse(JSON.stringify(manifest, (_, value: any) => patcher(value)));
}
