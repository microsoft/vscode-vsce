import { Manifest } from './manifest';
import { cloneDeepWith } from 'lodash';

export interface ITranslations {
	[key: string]: string;
}

const regex = /^%([\w\d.]+)%$/i;

function patcher(translations: ITranslations) {
	return value => {
		if (typeof value !== 'string') {
			return;
		}

		const match = regex.exec(value);

		if (!match) {
			return;
		}

		return translations[match[1]] || value;
	};
}

export function patchNLS(manifest: Manifest, translations: ITranslations): Manifest {
	return cloneDeepWith(manifest, patcher(translations)) as Manifest;
}