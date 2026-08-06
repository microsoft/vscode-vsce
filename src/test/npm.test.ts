import * as assert from 'assert';
import { getPnpmDependencyPaths } from '../npm';

interface TestDependency {
	name?: string;
	from?: string;
	path: string;
	dependencies?: Record<string, TestDependency>;
}

describe('pnpm dependencies', () => {
	const root = (dependencies: Record<string, TestDependency>): TestDependency => ({
		name: 'extension',
		path: '/extension',
		dependencies,
	});

	it('collects the full production dependency closure', () => {
		const shared = { from: 'shared', path: '/store/shared' };
		const result = getPnpmDependencyPaths([root({
			first: { from: 'first', path: '/store/first', dependencies: { shared } },
			second: { from: 'second', path: '/store/second', dependencies: { shared } },
		})]);

		assert.deepStrictEqual(result, [
			{ localPath: '/extension', path: '' },
			{ localPath: '/store/first', path: 'node_modules/first' },
			{ localPath: '/store/shared', path: 'node_modules/first/node_modules/shared' },
			{ localPath: '/store/second', path: 'node_modules/second' },
			{ localPath: '/store/shared', path: 'node_modules/second/node_modules/shared' },
		]);
	});

	it('collects selected dependency closures', () => {
		const result = getPnpmDependencyPaths([root({
			first: { from: 'first', path: '/store/first', dependencies: { child: { from: 'child', path: '/store/child' } } },
			second: { from: 'second', path: '/store/second' },
		})], ['first']);

		assert.deepStrictEqual(result, [
			{ localPath: '/extension', path: '' },
			{ localPath: '/store/first', path: 'node_modules/first' },
			{ localPath: '/store/child', path: 'node_modules/first/node_modules/child' },
		]);
	});

	it('supports an empty selected dependency list', () => {
		assert.deepStrictEqual(getPnpmDependencyPaths([root({ first: { path: '/store/first' } })], []), [{ localPath: '/extension', path: '' }]);
	});

	it('rejects missing selected dependencies', () => {
		assert.throws(() => getPnpmDependencyPaths([root({})], ['missing']), /Could not find dependency: missing/);
	});

	it('rejects multiple projects', () => {
		assert.throws(() => getPnpmDependencyPaths([root({}), root({})]), /Expected pnpm to return one project/);
	});
});