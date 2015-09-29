import { readManifest, collect } from '../out/package';
import * as path from 'path';
import * as fs from 'fs';
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
	
	it('should ignore .git/**', cb => {
		const cwd = fixture('uuid');
		
		if (!fs.existsSync(path.join(cwd, '.git'))) {
			fs.mkdirSync(path.join(cwd, '.git'));
		}
		
		if (!fs.existsSync(path.join(cwd, '.git', 'hello'))) {
			fs.writeFileSync(path.join(cwd, '.git', 'hello'), 'world');
		}
		
		readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 3);
				cb();
			})
			.catch(cb);
	});
	
	it('should ignore devDependencies', cb => {
		const cwd = fixture('devDependencies');
		
		readManifest(cwd)
			.then(manifest => collect(cwd, manifest))
			.then(files => {
				assert.equal(files.length, 4);
				assert.ok(files.some(f => /real\/dependency\.js/.test(f.path)));
				assert.ok(!files.some(f => /fake\/dependency\.js/.test(f.path)));
				cb();
			})
			.catch(cb);
	});
});