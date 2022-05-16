import { getPublicGalleryAPI } from './util';
import {
	ExtensionQueryFilterType,
	ExtensionQueryFlags,
	PublishedExtension,
} from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { tableView, wordTrim } from './viewutils';
const installationTarget = 'Microsoft.VisualStudio.Code';
const excludeFlags = '37888'; //Value to exclude un-published, locked or hidden extensions

interface VSCodePublishedExtension extends PublishedExtension {
	publisher: { displayName: string; publisherName: string };
}

export async function search(searchText: string, json: boolean = false, pageSize: number = 10): Promise<any> {
	const api = getPublicGalleryAPI();
	const results = (await api.extensionQuery({
		pageSize,
		criteria: [
			{ filterType: ExtensionQueryFilterType.SearchText, value: searchText },
			{ filterType: ExtensionQueryFilterType.InstallationTarget, value: installationTarget },
			{ filterType: ExtensionQueryFilterType.ExcludeWithFlags, value: excludeFlags },
		],
		flags: [ExtensionQueryFlags.ExcludeNonValidated, ExtensionQueryFlags.IncludeLatestVersionOnly],
	})) as VSCodePublishedExtension[];

	if (json) {
		console.log(JSON.stringify(results, undefined, '\t'));
		return;
	}

	if (!results.length) {
		console.log('No matching results');
		return;
	}

	console.log(
		[
			`Search results:`,
			'',
			...tableView([
				['<ExtensionId>', '<Name>', '<Description>'],
				...results.map(({ publisher: { publisherName }, extensionName, displayName, shortDescription }) => [
					publisherName + '.' + extensionName,
					displayName || '',
					(shortDescription || '').replace(/\n|\r|\t/g, ' '),
				]),
			]),
			'',
			'For more information on an extension use "vsce show <extensionId>"',
		]
			.map(line => wordTrim(line.replace(/\s+$/g, '')))
			.join('\n')
	);
}
