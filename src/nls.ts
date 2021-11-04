import { Manifest } from './manifest';

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

		return ((translations[match[1]] as unknown) ?? value) as T;
	};
}

export function patchNLS(manifest: Manifest, translations: ITranslations): Manifest {
	const patcher = createPatcher(translations);
	return JSON.parse(JSON.stringify(manifest, (_, value: any) => patcher(value)));
}
