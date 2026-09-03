/**
 * Returns the candidate most similar to `target`, if any is close enough
 * to be a plausible typo correction.
 */
export function findSimilar(target: string, candidates: Iterable<string>): string | undefined {
	let best: string | undefined;
	let bestDistance = Math.ceil(target.length * 0.4);
	for (const candidate of candidates) {
		const row = Array.from({ length: candidate.length + 1 }, (_, j) => j);
		for (let i = 1; i <= target.length; i++) {
			let diag = row[0];
			row[0] = i;
			for (let j = 1; j <= candidate.length; j++) {
				const tmp = row[j];
				row[j] = Math.min(row[j - 1] + 1, tmp + 1, diag + (target[i - 1] === candidate[j - 1] ? 0 : 1));
				diag = tmp;
			}
		}
		if (row[candidate.length] < bestDistance) {
			best = candidate;
			bestDistance = row[candidate.length];
		}
	}
	return best;
}
