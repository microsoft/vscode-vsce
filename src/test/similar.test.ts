import * as assert from 'assert';
import { findSimilar } from '../similar';

describe('findSimilar', () => {
	const tests: [string, string[], string | undefined][] = [
		['buld', ['build', 'test', 'lint'], 'build'],
		['tes', ['build', 'test', 'lint'], 'test'],
		['buil', ['build', 'built', 'lint'], 'build'],
		['buil', ['lint', 'built', 'build'], 'built'],
		['completely-different', ['build', 'test'], undefined],
		['build', [], undefined],
		['', ['build'], undefined],
		['build', [''], undefined],
		['build', ['build', 'test'], 'build'],
	];

	for (const [target, candidates, expected] of tests) {
		it(`findSimilar(${JSON.stringify(target)}, ${JSON.stringify(candidates)})`, () => {
			assert.strictEqual(findSimilar(target, candidates), expected);
		});
	}

	it('accepts iterables', () => {
		const tasks = new Map([
			['build', 1],
			['test', 2],
		]);
		assert.strictEqual(findSimilar('buld', tasks.keys()), 'build');
	});
});
