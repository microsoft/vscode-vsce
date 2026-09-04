import * as assert from 'assert';
import { findSimilar, levenshtein } from '../util';

/**
 * These tests pin down the exact behaviour of the "unknown command" suggestion layer.
 *
 * `vsce` used to compute edit distances with the `leven` package. `levenshtein` replaces
 * that dependency and `findSimilar` picks the suggestion, now returning the *closest*
 * command rather than the first one within 40% of its own length, which is why e.g.
 * `vsce delete-publishers` suggests `delete-publisher` instead of `ls-publishers`.
 *
 * There are three layers: `levenshtein` against a textbook reference implementation,
 * `findSimilar` against a reference selection implementation, and the `vsce <typo>` output
 * itself so that the wiring in `main.ts` is covered too.
 */

/**
 * The commands registered in `main.ts`, in registration order. `findSimilar` returns the
 * *first* acceptable candidate, so the order is part of the observable behaviour.
 */
const commands = [
	'ls',
	'package',
	'publish',
	'unpublish',
	'generate-manifest',
	'verify-signature',
	'ls-publishers',
	'delete-publisher',
	'login',
	'logout',
	'verify-pat',
	'show',
	'search',
];

/**
 * Textbook full matrix Levenshtein. Deliberately a different shape from the rolling row
 * implementation under test so that the two agreeing is meaningful.
 */
function referenceLevenshtein(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= a.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= b.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
		}
	}

	return matrix[a.length][b.length];
}

/** Straightforward "scan everything and keep the best" version of the selection rule. */
function referenceFindSimilar(target: string, candidates: string[]): string | undefined {
	const threshold = Math.ceil(target.length * 0.4);
	const withinThreshold = candidates.filter(c => referenceLevenshtein(c, target) < threshold);
	const distances = withinThreshold.map(c => referenceLevenshtein(c, target));

	return withinThreshold[distances.indexOf(Math.min(...distances))];
}

/** Thrown in place of `process.exit` so the CLI can be exercised in process. */
class ProcessExited extends Error {}

/** Deterministic PRNG so the randomised tests are reproducible. */
function createRandom(seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz-';

function randomString(random: () => number, maxLength: number): string {
	const length = Math.floor(random() * (maxLength + 1));
	let result = '';

	for (let i = 0; i < length; i++) {
		result += alphabet[Math.floor(random() * alphabet.length)];
	}

	return result;
}

/** Applies `edits` random insertions, deletions or substitutions to `value`. */
function randomEdits(random: () => number, value: string, edits: number): string {
	let result = value;

	for (let i = 0; i < edits; i++) {
		const at = Math.floor(random() * (result.length + 1));
		const letter = alphabet[Math.floor(random() * alphabet.length)];

		switch (Math.floor(random() * 3)) {
			case 0:
				result = result.slice(0, at) + letter + result.slice(at);
				break;
			case 1:
				result = result.slice(0, at) + result.slice(at + 1);
				break;
			default:
				result = result.slice(0, at) + letter + result.slice(at + 1);
				break;
		}
	}

	return result;
}

/** Every string of length <= `maxLength` over `letters`. */
function allStrings(letters: string, maxLength: number): string[] {
	let result = [''];
	let previous = [''];

	for (let length = 1; length <= maxLength; length++) {
		const next: string[] = [];

		for (const prefix of previous) {
			for (const letter of letters) {
				next.push(prefix + letter);
			}
		}

		result = result.concat(next);
		previous = next;
	}

	return result;
}

/** Single character edits of `value`, plus a few multi character ones. */
function mutations(value: string): string[] {
	const result = new Set<string>([value]);

	for (let i = 0; i < value.length; i++) {
		result.add(value.slice(0, i) + value.slice(i + 1));

		for (const letter of alphabet) {
			result.add(value.slice(0, i) + letter + value.slice(i));
			result.add(value.slice(0, i) + letter + value.slice(i + 1));
		}

		if (i + 1 < value.length) {
			result.add(value.slice(0, i) + value[i + 1] + value[i] + value.slice(i + 2));
		}

		for (let j = i + 1; j < value.length; j++) {
			result.add(value.slice(0, i) + value.slice(i + 1, j) + value.slice(j + 1));
		}
	}

	return [...result];
}

describe('levenshtein', () => {
	it('is zero for equal strings', () => {
		for (const command of commands) {
			assert.strictEqual(levenshtein(command, command), 0);
		}

		assert.strictEqual(levenshtein('', ''), 0);
	});

	it('is the length of the other string when one is empty', () => {
		assert.strictEqual(levenshtein('', 'publish'), 7);
		assert.strictEqual(levenshtein('publish', ''), 7);
		assert.strictEqual(levenshtein('', ''), 0);
	});

	it('counts a single insertion, deletion or substitution as one edit', () => {
		assert.strictEqual(levenshtein('publish', 'publishh'), 1);
		assert.strictEqual(levenshtein('publish', 'publis'), 1);
		assert.strictEqual(levenshtein('publish', 'publich'), 1);
	});

	it('counts a transposition as two edits', () => {
		// Levenshtein, not Damerau-Levenshtein: swapping two characters is a delete plus an insert.
		assert.strictEqual(levenshtein('login', 'lgoin'), 2);
		assert.strictEqual(levenshtein('show', 'shwo'), 2);
	});

	it('matches known distances', () => {
		const cases: [string, string, number][] = [
			['kitten', 'sitting', 3],
			['saturday', 'sunday', 3],
			['flaw', 'lawn', 2],
			['gumbo', 'gambol', 2],
			['book', 'back', 2],
			['abc', 'abc', 0],
			['abc', 'xyz', 3],
			['a', 'b', 1],
			['publish', 'unpublish', 2],
			['ls', 'ls-publishers', 11],
			['delete-publisher', 'ls-publishers', 6],
		];

		for (const [a, b, expected] of cases) {
			assert.strictEqual(levenshtein(a, b), expected, `levenshtein('${a}', '${b}')`);
		}
	});

	it('is case sensitive', () => {
		assert.strictEqual(levenshtein('PUBLISH', 'publish'), 7);
		assert.strictEqual(levenshtein('Publish', 'publish'), 1);
	});

	it('compares UTF-16 code units', () => {
		// An astral character is a surrogate pair, so it counts as two edits. This matches
		// what `leven` did and keeps behaviour identical for non-ASCII input.
		assert.strictEqual(levenshtein('😀', ''), 2);
		assert.strictEqual(levenshtein('😀', '😀'), 0);
		assert.strictEqual(levenshtein('😀', '😁'), 1);
		assert.strictEqual(levenshtein('café', 'cafe'), 1);
	});

	it('is symmetric', () => {
		const random = createRandom(1);

		for (let i = 0; i < 2000; i++) {
			const a = randomString(random, 12);
			const b = randomString(random, 12);
			assert.strictEqual(levenshtein(a, b), levenshtein(b, a), `levenshtein('${a}', '${b}')`);
		}
	});

	it('is zero only for equal strings', () => {
		const random = createRandom(2);

		for (let i = 0; i < 2000; i++) {
			const a = randomString(random, 8);
			const b = randomString(random, 8);
			assert.strictEqual(levenshtein(a, b) === 0, a === b, `levenshtein('${a}', '${b}')`);
		}
	});

	it('stays within the length bounds', () => {
		const random = createRandom(3);

		for (let i = 0; i < 2000; i++) {
			const a = randomString(random, 12);
			const b = randomString(random, 12);
			const distance = levenshtein(a, b);

			assert.ok(distance >= Math.abs(a.length - b.length), `levenshtein('${a}', '${b}') too small`);
			assert.ok(distance <= Math.max(a.length, b.length), `levenshtein('${a}', '${b}') too large`);
		}
	});

	it('satisfies the triangle inequality', () => {
		const random = createRandom(4);

		for (let i = 0; i < 1000; i++) {
			const a = randomString(random, 8);
			const b = randomString(random, 8);
			const c = randomString(random, 8);

			assert.ok(
				levenshtein(a, c) <= levenshtein(a, b) + levenshtein(b, c),
				`levenshtein('${a}', '${c}') > levenshtein('${a}', '${b}') + levenshtein('${b}', '${c}')`
			);
		}
	});

	it('does not carry state between calls', () => {
		assert.strictEqual(levenshtein('generate-manifest', 'generate-manifes'), 1);
		assert.strictEqual(levenshtein('ls', 'ls'), 0);
		assert.strictEqual(levenshtein('generate-manifest', 'generate-manifes'), 1);
	});

	it('short circuits equal strings without scanning them', () => {
		const long = 'a'.repeat(100000);
		assert.strictEqual(levenshtein(long, long), 0);
	});

	it('gives the same answer whichever argument is longer', () => {
		const random = createRandom(8);

		for (let i = 0; i < 2000; i++) {
			const short = randomString(random, 4);
			const long = randomString(random, 24);

			assert.strictEqual(levenshtein(short, long), referenceLevenshtein(short, long), `levenshtein('${short}', '${long}')`);
			assert.strictEqual(levenshtein(long, short), referenceLevenshtein(long, short), `levenshtein('${long}', '${short}')`);
		}
	});

	it('matches the reference implementation for every short string', () => {
		const strings = allStrings('ab-', 4);

		for (const a of strings) {
			for (const b of strings) {
				assert.strictEqual(levenshtein(a, b), referenceLevenshtein(a, b), `levenshtein('${a}', '${b}')`);
			}
		}
	});

	it('matches the reference implementation for command-like strings', () => {
		const random = createRandom(5);

		for (const command of commands) {
			for (const mutation of mutations(command)) {
				for (const other of commands) {
					assert.strictEqual(
						levenshtein(other, mutation),
						referenceLevenshtein(other, mutation),
						`levenshtein('${other}', '${mutation}')`
					);
				}
			}
		}

		for (let i = 0; i < 5000; i++) {
			const a = randomString(random, 20);
			const b = randomString(random, 20);
			assert.strictEqual(levenshtein(a, b), referenceLevenshtein(a, b), `levenshtein('${a}', '${b}')`);
		}
	});
});

describe('findSimilar', () => {
	it('suggests the command for realistic typos', () => {
		const cases: [string, string][] = [
			['publsh', 'publish'],
			['pubish', 'publish'],
			['publishh', 'publish'],
			['pblish', 'publish'],
			['pacakge', 'package'],
			['packge', 'package'],
			['pakage', 'package'],
			['unpublsh', 'unpublish'],
			['unpublis', 'unpublish'],
			['logn', 'login'],
			['lgout', 'logout'],
			['serch', 'search'],
			['seach', 'search'],
			['searhc', 'search'],
			['sow', 'show'],
			['lst', 'ls'],
			['lss', 'ls'],
			['generate-manifes', 'generate-manifest'],
			['generatemanifest', 'generate-manifest'],
			['verify-signatur', 'verify-signature'],
			['ls-publisher', 'ls-publishers'],
			['verify-pt', 'verify-pat'],
			['verifypat', 'verify-pat'],
			['create-publisher', 'delete-publisher'],
			['delete-publishers', 'delete-publisher'],
		];

		for (const [input, expected] of cases) {
			assert.strictEqual(findSimilar(input, commands), expected, `findSimilar('${input}')`);
		}
	});

	it('suggests the command itself for an exact match', () => {
		for (const command of commands) {
			assert.strictEqual(findSimilar(command, commands), command, `findSimilar('${command}')`);
		}
	});

	it('suggests nothing when no command is close enough', () => {
		const cases = ['', 'l', 'list', 'pkg', 'lgoin', 'logni', 'shwo', 'foo', 'install', 'npm', 'build', 'test'];

		for (const input of cases) {
			assert.strictEqual(findSimilar(input, commands), undefined, `findSimilar('${input}')`);
		}
	});

	it('returns the closest candidate rather than the first acceptable one', () => {
		// Both are within threshold for a seventeen character target, but 'delete-publisher'
		// is one edit away and 'ls-publishers' is five, and 'ls-publishers' comes first.
		assert.strictEqual(levenshtein('delete-publisher', 'delete-publishers'), 1);
		assert.strictEqual(levenshtein('ls-publishers', 'delete-publishers'), 5);
		assert.strictEqual(findSimilar('delete-publishers', commands), 'delete-publisher');

		assert.strictEqual(findSimilar('abc', ['abd', 'abc']), 'abc');
		assert.strictEqual(findSimilar('abc', ['abc', 'abd']), 'abc');
	});

	it('breaks ties in favour of the first candidate', () => {
		assert.strictEqual(levenshtein('abd', 'abc'), 1);
		assert.strictEqual(levenshtein('abe', 'abc'), 1);
		assert.strictEqual(findSimilar('abc', ['abd', 'abe']), 'abd');
		assert.strictEqual(findSimilar('abc', ['abe', 'abd']), 'abe');
	});

	it('measures the threshold against the target, not the candidate', () => {
		// One edit is acceptable for a three character target even though the two character
		// candidate is shorter than the target.
		assert.strictEqual(levenshtein('ls', 'lst'), 1);
		assert.strictEqual(findSimilar('lst', ['ls']), 'ls');

		// Six edits are not acceptable for a ten character target even though the candidate
		// is sixteen characters long.
		assert.strictEqual(levenshtein('delete-publisher', 'delete-pub'), 6);
		assert.strictEqual(findSimilar('delete-pub', ['delete-publisher']), undefined);
	});

	it('accepts strictly fewer edits than 40% of the target length', () => {
		for (let length = 1; length <= 20; length++) {
			const target = 'a'.repeat(length);
			const maxAcceptedDistance = Math.ceil(length * 0.4) - 1;

			const accepted = 'a'.repeat(length - maxAcceptedDistance);
			assert.strictEqual(levenshtein(accepted, target), maxAcceptedDistance, `distance for length ${length}`);
			assert.strictEqual(findSimilar(target, [accepted]), accepted, `findSimilar('${target}', ['${accepted}'])`);

			const rejected = 'a'.repeat(length - maxAcceptedDistance - 1);
			assert.strictEqual(levenshtein(rejected, target), maxAcceptedDistance + 1, `distance for length ${length}`);
			assert.strictEqual(findSimilar(target, [rejected]), undefined, `findSimilar('${target}', ['${rejected}'])`);
		}
	});

	it('suggests nothing for an empty target', () => {
		// An empty target has a threshold of zero, so nothing can beat it.
		assert.strictEqual(findSimilar('', ['']), undefined);
		assert.strictEqual(findSimilar('', commands), undefined);
	});

	it('suggests nothing when there are no candidates', () => {
		assert.strictEqual(findSimilar('publsh', []), undefined);
	});

	it('accepts any iterable of candidates', () => {
		assert.strictEqual(findSimilar('publsh', new Set(commands)), 'publish');
		assert.strictEqual(findSimilar('publsh', commands[Symbol.iterator]()), 'publish');
	});

	it('considers every candidate', () => {
		const visited: string[] = [];

		function* candidates(): Generator<string> {
			for (const candidate of ['publish', 'package', 'publsh']) {
				visited.push(candidate);
				yield candidate;
			}
		}

		// The exact match is last, so a short circuiting implementation would miss it.
		assert.strictEqual(findSimilar('publsh', candidates()), 'publsh');
		assert.deepStrictEqual(visited, ['publish', 'package', 'publsh']);
	});

	it('does not modify the candidates', () => {
		const candidates = [...commands];
		findSimilar('publsh', candidates);
		assert.deepStrictEqual(candidates, commands);
	});

	it('matches the reference implementation for every mutation of every command', () => {
		for (const command of commands) {
			for (const mutation of mutations(command)) {
				assert.strictEqual(
					findSimilar(mutation, commands),
					referenceFindSimilar(mutation, commands),
					`findSimilar('${mutation}')`
				);
			}
		}
	});

	it('matches the reference implementation for random input', () => {
		const random = createRandom(6);

		for (let i = 0; i < 20000; i++) {
			// Half unrelated noise, half near misses of a real command, so that both the
			// "no suggestion" and the "suggestion" paths are exercised heavily.
			const target =
				random() < 0.5
					? randomString(random, 20)
					: randomEdits(random, commands[Math.floor(random() * commands.length)], Math.floor(random() * 6));

			assert.strictEqual(findSimilar(target, commands), referenceFindSimilar(target, commands), `findSimilar('${target}')`);
		}
	});

	it('matches the reference implementation for random candidate sets', () => {
		const random = createRandom(7);

		for (let i = 0; i < 5000; i++) {
			// Candidates and target are all near misses of a shared base word, so several
			// candidates are typically within threshold and the tie breaking rule matters.
			const base = randomString(random, 12);
			const candidates: string[] = [];

			for (let j = 0, count = Math.floor(random() * 6); j < count; j++) {
				candidates.push(randomEdits(random, base, Math.floor(random() * 4)));
			}

			const target = randomEdits(random, base, Math.floor(random() * 4));
			assert.strictEqual(
				findSimilar(target, candidates),
				referenceFindSimilar(target, candidates),
				`findSimilar('${target}', ${JSON.stringify(candidates)})`
			);
		}
	});

	it('improves on the suggestions the leven based implementation used to give', () => {
		// The old code returned the first candidate within 40% of *its own* length, which
		// meant a much closer command later in the list was ignored. These are the cases
		// that motivated the change; they are listed here so the improvement is not lost.
		const cases: [string, string | undefined, string | undefined][] = [
			['unpublish', 'publish', 'unpublish'],
			['delete-publishers', 'ls-publishers', 'delete-publisher'],
			['publish-ls', 'ls-publishers', 'publish'],
			['lst', undefined, 'ls'],
			['lss', undefined, 'ls'],
			['verifypat', undefined, 'verify-pat'],
			['generatemanifest', undefined, 'generate-manifest'],
		];

		for (const [input, before, after] of cases) {
			assert.notStrictEqual(before, after);
			assert.strictEqual(findSimilar(input, commands), after, `findSimilar('${input}')`);
		}
	});
});

describe('unknown command help', () => {
	const runVsce = require('../main') as (argv: string[]) => void;

	/**
	 * Runs `vsce <command>` in process, capturing what it prints and the exit code. Both
	 * streams are captured because `log.error` writes to stdout under GitHub Actions and to
	 * `console.error` everywhere else.
	 */
	function runUnknownCommand(command: string): { output: string; exitCode: number | undefined } {
		const chunks: string[] = [];
		const originalWrite = process.stdout.write;
		const originalError = console.error;
		const originalExit = process.exit;
		let exitCode: number | undefined;

		(process.stdout as any).write = (chunk: any) => {
			chunks.push(String(chunk));
			return true;
		};
		console.error = (...args: any[]) => {
			chunks.push(`${args.join(' ')}\n`);
		};
		(process as any).exit = (code?: number) => {
			exitCode = code;
			throw new ProcessExited();
		};

		try {
			runVsce(['node', 'vsce', command]);
		} catch (error) {
			if (!(error instanceof ProcessExited)) {
				throw error;
			}
		} finally {
			(process.stdout as any).write = originalWrite;
			console.error = originalError;
			(process as any).exit = originalExit;
		}

		return { output: chunks.join(''), exitCode };
	}

	it('suggests a command when one is close enough', () => {
		const { output, exitCode } = runUnknownCommand('sow');

		assert.strictEqual(exitCode, 1);
		assert.ok(output.endsWith(`\n Unknown command 'sow', did you mean 'show'?\n`), output.slice(-200));
	});

	it('offers exactly the commands the tests above assume', () => {
		// Guards the tables in this file against new commands being registered in main.ts:
		// a new command changes which suggestion wins, and ties are broken by registration
		// order, so both the contents and the order of the list are observable behaviour.
		const { output } = runUnknownCommand('foo');
		const commandSection = output.slice(output.indexOf('\nCommands:\n'));
		const registered = [...commandSection.matchAll(/^ {2}(\S+)/gm)]
			.map(match => match[1].split('|')[0])
			.filter(name => name !== 'help');

		assert.deepStrictEqual(registered, commands);
	});

	it('suggests nothing when no command is close enough', () => {
		const { output, exitCode } = runUnknownCommand('foo');

		assert.strictEqual(exitCode, 1);
		assert.ok(output.endsWith(`\n Unknown command 'foo'.\n`), output.slice(-200));
	});

	it('suggests the closest command, not the first matching one', () => {
		const { output } = runUnknownCommand('delete-publishers');

		assert.ok(
			output.endsWith(`\n Unknown command 'delete-publishers', did you mean 'delete-publisher'?\n`),
			output.slice(-200)
		);
	});

	it('keeps the create-publisher message', () => {
		const { output, exitCode } = runUnknownCommand('create-publisher');

		assert.strictEqual(exitCode, 1);
		assert.ok(output.includes(`The 'create-publisher' command is no longer available`), output.slice(-200));
	});
});
