import { readManifest, collect } from '../out/package';
import * as path from 'path';
import * as assert from 'assert';

const fixture = name => path.join(__dirname, 'fixtures', name);

describe('collect', () => {
	
	it('should catch all files', cb => {
		const cwd = fixture('uuid');
		
		readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 3);
				cb();
			})
			.catch(cb);
	});
});