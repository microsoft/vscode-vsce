export type ViewTableRow = string[];
export type ViewTable = ViewTableRow[];

const fixedLocale = 'en-us';
const format = {
	date: { month: 'long', day: 'numeric', year: 'numeric' },
	time: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
};

export function formatDate(date) { return date.toLocaleString(fixedLocale, format.date); }
export function formatTime(date) { return date.toLocaleString(fixedLocale, format.time); }
export function formatDateTime(date) { return date.toLocaleString(fixedLocale, { ...format.date, ...format.time }); }

export function repeatString(text: string, count: number): string {
	let result: string = '';
	for (let i = 0; i < count; i++) {
		result += text;
	}
	return result;
}

export function ratingStars(rating: number, total = 5): string {
	const c = Math.min(Math.round(rating), total);
	return `${repeatString('\u{2605} ', c)}${repeatString('\u{2606} ', total - c)}`;
}

export function tableView(table: ViewTable, spacing: number = 2): string[] {
	const maxLen = {};
	table.forEach(row => row.forEach((cell, i) => maxLen[i] = Math.max(maxLen[i] || 0, cell.length)));
	return table.map(row => row.map((cell, i) => `${cell}${repeatString(' ', maxLen[i] - cell.length + spacing)}`).join(''));
}

export function wordWrap(text: string, width: number = 80): string {
	const [indent = ''] = text.match(/^\s+/) || [];
	const maxWidth = width - indent.length;
	return text
		.replace(/^\s+/, '')
		.split('')
		.reduce(([out, buffer, pos], ch, i) => {
			const nl = pos === maxWidth ? `\n${indent}` : '';
			const newPos: number = nl ? 0 : +pos + 1;
			return / |-|,|\./.test(ch) ?
				[`${out}${buffer}${ch}${nl}`, '', newPos] : [`${out}${nl}`, buffer+ch, newPos];
		}, [indent, '', 0])
		.slice(0, 2)
		.join('');
};

export function indentRow(row: string) { return `  ${row}`; };
