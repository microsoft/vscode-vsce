import { getPublicGalleryAPI, log } from './util';
import { ExtensionQueryFlags, PublishedExtension } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { ViewTable, formatDate, formatDateTime, ratingStars, tableView, indentRow, wordWrap, icons } from './viewutils';

const limitVersions = 6;
const isExtensionTag = /^__ext_(.*)$/;

export interface ExtensionStatisticsMap {
	install: number;
	averagerating: number;
	ratingcount: number;
}

interface VSCodePublishedExtension extends PublishedExtension {
	publisher: { displayName: string; publisherName: string };
}

export function show(extensionId: string, json: boolean = false): Promise<any> {
	const flags = [
		ExtensionQueryFlags.IncludeCategoryAndTags,
		ExtensionQueryFlags.IncludeMetadata,
		ExtensionQueryFlags.IncludeStatistics,
		ExtensionQueryFlags.IncludeVersions,
	];
	return getPublicGalleryAPI()
		.getExtension(extensionId, flags)
		.then(extension => {
			if (json) {
				console.log(JSON.stringify(extension, undefined, '\t'));
			} else {
				if (extension === undefined) {
					log.error(`Extension "${extensionId}" not found.`);
				} else {
					showOverview(extension as VSCodePublishedExtension);
				}
			}
		});
}

function showOverview({
	displayName = 'unknown',
	extensionName = 'unknown',
	shortDescription = '',
	versions = [],
	publisher: { displayName: publisherDisplayName, publisherName },
	categories = [],
	tags = [],
	statistics = [],
	publishedDate,
	lastUpdated,
}: VSCodePublishedExtension) {
	const [{ version = 'unknown' } = {}] = versions;

	// Create formatted table list of versions
	const versionList = <ViewTable>(
		versions.slice(0, limitVersions).map(({ version, lastUpdated }) => [version, formatDate(lastUpdated!)])
	);

	const { install: installs = 0, averagerating = 0, ratingcount = 0 } = statistics.reduce(
		(map, { statisticName, value }) => ({ ...map, [statisticName!]: value }),
		<ExtensionStatisticsMap>{}
	);

	// Render
	console.log(
		[
			`${displayName}`,
			`${publisherDisplayName} | ${icons.download} ` +
				`${Number(installs).toLocaleString()} installs |` +
				` ${ratingStars(averagerating)} (${ratingcount})`,
			'',
			`${shortDescription}`,
			'',
			'Recent versions:',
			...(versionList.length ? tableView(versionList).map(indentRow) : ['no versions found']),
			'',
			'Categories:',
			`  ${categories.join(', ')}`,
			'',
			'Tags:',
			`  ${tags.filter(tag => !isExtensionTag.test(tag)).join(', ')}`,
			'',
			'More info:',
			...tableView([
				['Unique identifier:', `${publisherName}.${extensionName}`],
				['Version:', version],
				['Last updated:', formatDateTime(lastUpdated!)],
				['Publisher:', publisherDisplayName],
				['Published at:', formatDate(publishedDate!)],
			]).map(indentRow),
			'',
			'Statistics:',
			...tableView(
				<ViewTable>statistics.map(({ statisticName, value }) => [statisticName, Number(value).toFixed(2)])
			).map(indentRow),
		]
			.map(line => wordWrap(line))
			.join('\n')
	);
}
