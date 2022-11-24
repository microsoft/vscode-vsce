import { getPublicGalleryAPI } from './util';
import {
	ExtensionQueryFilterType,
	ExtensionQueryFlags,
	PublishedExtension,
	ExtensionStatistic,
} from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { ratingStars, tableView, wordTrim } from './viewutils';
import { ExtensionStatisticsMap } from './show';
const installationTarget = 'Microsoft.VisualStudio.Code';
const excludeFlags = '37888'; //Value to exclude un-published, locked or hidden extensions

const baseResultsTableHeaders = ['<ExtensionId>', '<Publisher>', '<Name>'];

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
			stats ? ExtensionQueryFlags.IncludeStatistics : 0,
		],
	})) as VSCodePublishedExtension[];

	if (stats || !json) {
		console.log(
			[
				`Search results:`,
				'',
				...buildResultTableView(results, stats),
				'',
				'For more information on an extension use "vsce show <extensionId>"',
			]
				.map(line => wordTrim(line.replace(/\s+$/g, '')))
				.join('\n')
		);
		return;
	}

	if (!results.length) {
		console.log('No matching results');
		return;
	}

	if (json) {
		console.log(JSON.stringify(results, undefined, '\t'));
		return;
	}
}

function buildResultTableView(results: VSCodePublishedExtension[], stats: boolean): string[] {
	const values = results.map(({ publisher, extensionName, displayName, shortDescription, statistics }) => [
		publisher.publisherName + '.' + extensionName,
		publisher.displayName,
		wordTrim(displayName || '', 25),
		stats ? buildExtensionStatisticsText(statistics!) : wordTrim(shortDescription || '', 150).replace(/\n|\r|\t/g, ' '),
	]);

	var resultsTableHeaders = stats
		? [...baseResultsTableHeaders, '<Installs>', '<Rating>']
		: [...baseResultsTableHeaders, '<Description>'];

	const resultsTable = tableView([resultsTableHeaders, ...values]);

	return resultsTable;
}

function buildExtensionStatisticsText(statistics: ExtensionStatistic[]): string {
	const { install: installs = 0, averagerating = 0, ratingcount = 0 } = statistics?.reduce(
		(map, { statisticName, value }) => ({ ...map, [statisticName!]: value }),
		<ExtensionStatisticsMap>{}
	);

	return (
		`${Number(installs).toLocaleString('en-US').padStart(12, ' ')} \t\t` +
		` ${ratingStars(averagerating).padEnd(3, ' ')} (${ratingcount})`
	);
}
