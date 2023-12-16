import { getPublicGalleryAPI, log } from './util';
import { ExtensionQueryFlags, ExtensionVersion, PublishedExtension } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
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
		ExtensionQueryFlags.IncludeVersionProperties,
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

function round(num: number): number {
	return Math.round(num * 100) / 100;
}

function unit(value: number, statisticName: string): string {
	switch (statisticName) {
		case 'install':
			return `${value} installs`;
		case 'updateCount':
			return `${value} updates`;
		case 'averagerating':
		case 'weightedRating':
			return `${value} stars`;
		case 'ratingcount':
			return `${value} ratings`;
		case 'downloadCount':
			return `${value} downloads`;
		default:
			return `${value}`;
	}
}

function getVersionTable(versions: ExtensionVersion[]): ViewTable {
	if (!versions.length) {
		return [];
	}

	const set = new Set<string>();
	const result = versions
		.filter(({ version }) => !set.has(version!) && set.add(version!))
		.slice(0, limitVersions)
		.map(({ version, lastUpdated, properties }) => [version, formatDate(lastUpdated!), properties?.some(p => p.key === 'Microsoft.VisualStudio.Code.PreRelease')]);

	// Only show pre-release column if there are any pre-releases
	if (result.every(v => !v[2])) {
		for (const version of result) {
			version.pop();
		}
		result.unshift(['Version', 'Last Updated']);
	} else {
		for (const version of result) {
			version[2] = version[2] ? `✔️` : '';
		}
		result.unshift(['Version', 'Last Updated', 'Pre-release']);
	}

	return result as ViewTable;
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
	const versionTable = getVersionTable(versions);

	const latestVersionTargets = versions
		.filter(v => v.version === version)
		.filter(v => v.targetPlatform)
		.map(v => v.targetPlatform);

	const { install: installs = 0, averagerating = 0, ratingcount = 0 } = statistics.reduce(
		(map, { statisticName, value }) => ({ ...map, [statisticName!]: value }),
		<ExtensionStatisticsMap>{}
	);

	const rows = [
		`${displayName}`,
		`${publisherDisplayName} | ${icons.download} ` +
		`${Number(installs).toLocaleString()} installs |` +
		` ${ratingStars(averagerating)} (${ratingcount})`,
		'',
		`${shortDescription}`,
		'',
		...(versionTable.length ? tableView(versionTable).map(indentRow) : ['no versions found']),
		'',
		'Categories:',
		`  ${categories.join(', ')}`,
		'',
		'Tags:',
		`  ${tags.filter(tag => !isExtensionTag.test(tag)).join(', ')}`
	];

	if (latestVersionTargets.length) {
		rows.push(
			'',
			'Targets:',
			`  ${latestVersionTargets.join(', ')}`,
		);
	}

	rows.push(
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
			<ViewTable>statistics
				.filter(({ statisticName }) => !/^trending/.test(statisticName!))
				.map(({ statisticName, value }) => [statisticName, unit(round(value!), statisticName!)])
		).map(indentRow),
	);

	// Render
	console.log(rows.map(line => wordWrap(line)).join('\n'));
}
