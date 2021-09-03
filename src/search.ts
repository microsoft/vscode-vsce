import { getPublicGalleryAPI } from './util';
import { ExtensionQueryFilterType, ExtensionQueryFlags } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { tableView, wordTrim } from './viewutils';

const pageSize = 100;
const installationTarget = 'Microsoft.VisualStudio.Code';
const excludeFlags = '37888'; //Value to exclude un-published, locked or hidden extensions

export async function search(searchText: string, json: boolean = false): Promise<any> {
	const api = getPublicGalleryAPI();
	const results = await api.extensionQuery({
		pageSize,
		criteria: [
			{ filterType: ExtensionQueryFilterType.SearchText, value: searchText },
			{ filterType: ExtensionQueryFilterType.InstallationTarget, value: installationTarget },
			{ filterType: ExtensionQueryFilterType.ExcludeWithFlags, value: excludeFlags },
		],
		flags: [ExtensionQueryFlags.ExcludeNonValidated, ExtensionQueryFlags.IncludeLatestVersionOnly],
	});

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
				['<ExtensionId>', '<Description>'],
				...results.map(({ publisher: { publisherName }, extensionName, shortDescription }) => [
					publisherName + '.' + extensionName,
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
