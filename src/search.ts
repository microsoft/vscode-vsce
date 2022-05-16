import { getPublicGalleryAPI } from './util';
import {
	ExtensionQueryFilterType,
	ExtensionQueryFlags,
	PublishedExtension,
	ExtensionStatistic,
} from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { ratingStars, tableView, wordTrim } from './viewutils';
import { ExtensionStatiticsMap } from './show';
const installationTarget = 'Microsoft.VisualStudio.Code';
const excludeFlags = '37888'; //Value to exclude un-published, locked or hidden extensions

interface VSCodePublishedExtension extends PublishedExtension {
	publisher: { displayName: string; publisherName: string };
}
export async function search(
	searchText: string,
	json: boolean = false,
	pageSize: number = 10,
	stats: boolean = false
): Promise<any> {
	const api = getPublicGalleryAPI();
	const results = (await api.extensionQuery({
		pageSize,
		criteria: [
			{ filterType: ExtensionQueryFilterType.SearchText, value: searchText },
			{ filterType: ExtensionQueryFilterType.InstallationTarget, value: installationTarget },
			{ filterType: ExtensionQueryFilterType.ExcludeWithFlags, value: excludeFlags },
		],
		flags: [
			ExtensionQueryFlags.ExcludeNonValidated,
			ExtensionQueryFlags.IncludeLatestVersionOnly,
			ExtensionQueryFlags.IncludeStatistics,
		],
	})) as VSCodePublishedExtension[];

	if (stats) {
		console.log(
			[
				`Search results:`,
				'',
				...tableView([
					['<ExtensionId>', '<Name>', '<Installs>', '<Rating>'],
					...results.map(({ publisher: { publisherName }, extensionName, displayName, statistics }) => [
						publisherName + '.' + extensionName,
						wordTrim(displayName || '', 25),
						getStats(statistics!),
					]),
				]),
				'',
				'For more information on an extension use "vsce show <extensionId>"',
			]
				.map(line => wordTrim(line.replace(/\s+$/g, '')))
				.join('\n')
		);
		return;
	}

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
					wordTrim(displayName || '', 25),
					wordTrim(shortDescription || '', 150).replace(/\n|\r|\t/g, ' '),
				]),
			]),
			'',
			'For more information on an extension use "vsce show <extensionId>"',
		]
			.map(line => wordTrim(line.replace(/\s+$/g, '')))
			.join('\n')
	);
}
function getStats(statistics: ExtensionStatistic[]): string {
	const { install: installs = 0, averagerating = 0, ratingcount = 0 } = statistics?.reduce(
		(map, { statisticName, value }) => ({ ...map, [statisticName!]: value }),
		<ExtensionStatiticsMap>{}
	);

	return (
		`${Number(installs).toLocaleString('en-US').padStart(12, ' ')} \t\t` +
		` ${ratingStars(averagerating).padEnd(3, ' ')} (${ratingcount})`
	);
}
