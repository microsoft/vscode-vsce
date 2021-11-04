export type ViewTableRow = string[];
export type ViewTable = ViewTableRow[];

const fixedLocale = 'en-us';
const format = {
	date: { month: 'long', day: 'numeric', year: 'numeric' } as Intl.DateTimeFormatOptions,
	time: { hour: 'numeric', minute: 'numeric', second: 'numeric' } as Intl.DateTimeFormatOptions,
};

const columns = process.stdout.columns ? process.stdout.columns : 80;

// xxx: Windows cmd + powershell standard fonts currently don't support the full
// unicode charset. For now we use fallback icons when on windows.
const useFallbackIcons = process.platform === 'win32';

export const icons = useFallbackIcons
	? { download: '\u{2193}', star: '\u{2665}', emptyStar: '\u{2022}' }
	: { download: '\u{2913}', star: '\u{2605}', emptyStar: '\u{2606}' };

export function formatDate(date: Date) {
	return date.toLocaleString(fixedLocale, format.date);
}
export function formatTime(date: Date) {
	return date.toLocaleString(fixedLocale, format.time);
}
export function formatDateTime(date: Date) {
	return date.toLocaleString(fixedLocale, { ...format.date, ...format.time });
}

export function repeatString(text: string, count: number): string {
	let result: string = '';
	for (let i = 0; i < count; i++) {
		result += text;
	}
	return result;
}

export function ratingStars(rating: number, total = 5): string {
	const c = Math.min(Math.round(rating), total);
	return `${repeatString(icons.star + ' ', c)}${repeatString(icons.emptyStar + ' ', total - c)}`;
}

export function tableView(table: ViewTable, spacing: number = 2): string[] {
	const maxLen: Record<number, number> = {};
	table.forEach(row => row.forEach((cell, i) => (maxLen[i] = Math.max(maxLen[i] || 0, cell.length))));
	return table.map(row =>
		row.map((cell, i) => `${cell}${repeatString(' ', maxLen[i] - cell.length + spacing)}`).join('')
	);
}

export function wordWrap(text: string, width: number = columns): string {
	const [indent = ''] = text.match(/^\s+/) || [];
	const maxWidth = width - indent.length;
	return text
		.replace(/^\s+/, '')
		.split('')
		.reduce(
			([out, buffer, pos], ch) => {
				const nl = pos === maxWidth ? `\n${indent}` : '';
				const newPos: number = nl ? 0 : +pos + 1;
				return / |-|,|\./.test(ch) ? [`${out}${buffer}${ch}${nl}`, '', newPos] : [`${out}${nl}`, buffer + ch, newPos];
			},
			[indent, '', 0]
		)
		.slice(0, 2)
		.join('');
}

export function indentRow(row: string) {
	return `  ${row}`;
}

export function wordTrim(text: string, width: number = columns, indicator = '...') {
	if (text.length > width) {
		return text.substr(0, width - indicator.length) + indicator;
	}
	return text;
}
