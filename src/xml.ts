import { parseString } from 'xml2js';
import * as denodeify from 'denodeify';

function createXMLParser<T>(): (raw: string) => Promise<T> {
	return denodeify<string, T>(parseString);
}

export type XMLManifest = {
	PackageManifest: {
		$: { Version: string; xmlns: string };
		Metadata: {
			Description: { _: string }[];
			DisplayName: string[];
			Identity: { $: { Id: string; Version: string; Publisher: string; TargetPlatform?: string } }[];
			Tags: string[];
			GalleryFlags: string[];
			License: string[];
			Icon: string[];
			Properties: { Property: { $: { Id: string; Value: string } }[] }[];
			Categories: string[];
			Badges: { Badge: { $: { Link: string; ImgUri: string; Description: string } }[] }[];
		}[];
		Installation: { InstallationTarget: { $: { Id: string } }[] }[];
		Dependencies: string[];
		Assets: { Asset: { $: { Type: string; Path: string } }[] }[];
	};
};

export type ContentTypes = {
	Types: {
		Default: { $: { Extension: string; ContentType } }[];
	};
};

export const parseXmlManifest = createXMLParser<XMLManifest>();
export const parseContentTypes = createXMLParser<ContentTypes>();
