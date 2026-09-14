import * as assert from 'assert';
import { parsePackageSpec } from '../packageSpec';

describe('parsePackageSpec', () => {
	it('parses unscoped packages', () => {
		assert.deepStrictEqual(parsePackageSpec('example@^1.2.3'), {
			name: 'example',
			range: '>=1.2.3 <2.0.0-0',
			version: '1.2.3',
		});
	});

	it('parses scoped packages', () => {
		assert.deepStrictEqual(parsePackageSpec('@types/vscode@~1.2.3'), {
			name: '@types/vscode',
			range: '>=1.2.3 <1.3.0-0',
			version: '1.2.3',
		});
	});

	it('handles packages without versions', () => {
		assert.deepStrictEqual(parsePackageSpec('example'), {
			name: 'example',
			range: '*',
			version: 'latest',
		});
		assert.deepStrictEqual(parsePackageSpec('@scope/example'), {
			name: '@scope/example',
			range: '*',
			version: 'latest',
		});
	});

	it('rejects invalid versions', () => {
		assert.throws(() => parsePackageSpec('example@not-a-version'), /Invalid semver range/);
	});
});
