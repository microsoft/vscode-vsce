import { getPublicGalleryAPI } from './util';
import { ExtensionQueryFlags, PublishedExtension } from 'vso-node-api/interfaces/GalleryInterfaces';

export interface ExtensionStatiticsMap {
	install: number;
	averagerating: number;
	ratingcount:number;
}

export type ViewTableRow = string[];
export type ViewTable = ViewTableRow[];

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
					console.log(`Error: Extension "${extensionId}" not found.`);
				} else {
					showOverview(extension);
				}
			}
		});
}

const fixedLocale = 'en-us';
const formatDate = { month: 'long', day: 'numeric', year: 'numeric' };
const formatTime = { hour: 'numeric', minute: 'numeric', second: 'numeric' };
const formatDateTime = { ...formatDate, ...formatTime };

function repeatString(text: string, count: number): string {
	let result: string = '';
	for (let i = 0; i < count; i++) {
		result += text;
	}
	return result;
}

function ratingStars(rating: number): string {
	const c = Math.min(Math.round(rating), 5);
	return `${repeatString('\u{2605} ', c)}${repeatString('\u{2606} ', 5 - c)}`;
}

function tableView(table: ViewTable, spacing: number = 2): string[] {
	const maxLen = {};
	table.forEach(row => row.forEach((cell, i) => maxLen[i] = Math.max(maxLen[i] || 0, cell.length)));
	return table.map(row => row.map((cell, i) => `${cell}${repeatString(' ', maxLen[i] - cell.length + spacing)}`).join(''));
}

function wordWrap(text: string, width: number = 80): string {
	return text
		.split('')
		.reduce(([out, buffer, pos], ch, i) => {
			const nl = pos === width ? '\n' : '';
			const newPos: number = nl ? 0 : +pos + 1;
			return ch === ' ' ? [`${out}${buffer} ${nl}`, '', newPos] : [`${out}${nl}`, buffer+ch, newPos];
		}, ['', '', 0])
		.slice(0, 2)
		.join('');
};

const indentRow = (row: string) => `  ${row}`;

function showOverview({
	displayName,
	extensionName,
	shortDescription,
	versions,
	publisher: {
		displayName:publisherDisplayName,
		publisherName
	},
	categories,
	tags,
	statistics,
	publishedDate,
	lastUpdated,
}: PublishedExtension) {

	const [{ version = 'unknown' } = {}] = versions;

	// Create formatted table list of versions
	const versionList = <ViewTable>versions
		.slice(0, 6)
		.map(({version, lastUpdated}) => [version, lastUpdated.toLocaleString(fixedLocale, formatDate)]);

	const {
		install: installs = 0,
		averagerating = 0,
		ratingcount = 0,
	} = statistics
		.reduce((map, {statisticName, value}) => ({ ...map, [statisticName]: value }), <ExtensionStatiticsMap>{});

	// Render
	console.log([
		`${displayName}`,
		`${publisherDisplayName} | ${'\u2913'}` +
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
		`  ${tags.join(', ')}`,
		'',
		'More info:',
		...tableView([
			[ 'Uniq identifier:', `${publisherName}.${extensionName}` ],
			[ 'Version:', version ],
			[ 'Last updated:', lastUpdated.toLocaleString(fixedLocale, formatDateTime) ],
			[ 'Publisher:', publisherDisplayName ],
			[ 'Published at:', publishedDate.toLocaleString(fixedLocale, formatDate) ],
		])
			.map(indentRow),
		'',
		'Statistics:',
		...tableView(<ViewTable>statistics.map(({statisticName, value}) => [statisticName, Number(value).toFixed(2)]))
			.map(indentRow),
	]
		.map(line => wordWrap(line))
		.join('\n'));
}
