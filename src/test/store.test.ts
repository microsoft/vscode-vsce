import * as assert from 'assert';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { FileStore } from '../store';

describe('FileStore', () => {
	it('works', async () => {
		const name = tmp.tmpNameSync();
		const store = await FileStore.open(name);

		assert.deepStrictEqual(store.get('joe'), undefined);
		assert.deepStrictEqual([...store], []);
		assert.ok(!fs.existsSync(name));

		await store.add({ name: 'joe', pat: 'abc' });
		assert.deepStrictEqual(store.get('joe'), { name: 'joe', pat: 'abc' });
		assert.deepStrictEqual([...store], [{ name: 'joe', pat: 'abc' }]);
		assert.deepStrictEqual(JSON.parse(fs.readFileSync(name, 'utf8')), {
			publishers: [{ name: 'joe', pat: 'abc' }],
		});

		await store.add({ name: 'joe', pat: 'what' });
		assert.deepStrictEqual(store.get('joe'), { name: 'joe', pat: 'what' });
		assert.deepStrictEqual([...store], [{ name: 'joe', pat: 'what' }]);
		assert.deepStrictEqual(JSON.parse(fs.readFileSync(name, 'utf8')), {
			publishers: [{ name: 'joe', pat: 'what' }],
		});

		await store.add({ name: 'jane', pat: 'oh' });
		assert.deepStrictEqual(store.get('joe'), { name: 'joe', pat: 'what' });
		assert.deepStrictEqual(store.get('jane'), { name: 'jane', pat: 'oh' });
		assert.deepStrictEqual(
			[...store],
			[
				{ name: 'joe', pat: 'what' },
				{ name: 'jane', pat: 'oh' },
			]
		);
		assert.deepStrictEqual(JSON.parse(fs.readFileSync(name, 'utf8')), {
			publishers: [
				{ name: 'joe', pat: 'what' },
				{ name: 'jane', pat: 'oh' },
			],
		});

		await store.delete('joe');
		assert.deepStrictEqual(store.get('joe'), undefined);
		assert.deepStrictEqual(store.get('jane'), { name: 'jane', pat: 'oh' });
		assert.deepStrictEqual([...store], [{ name: 'jane', pat: 'oh' }]);
		assert.deepStrictEqual(JSON.parse(fs.readFileSync(name, 'utf8')), {
			publishers: [{ name: 'jane', pat: 'oh' }],
		});

		await store.delete('joe');
		assert.deepStrictEqual(store.get('joe'), undefined);
		assert.deepStrictEqual(store.get('jane'), { name: 'jane', pat: 'oh' });
		assert.deepStrictEqual([...store], [{ name: 'jane', pat: 'oh' }]);
		assert.deepStrictEqual(JSON.parse(fs.readFileSync(name, 'utf8')), {
			publishers: [{ name: 'jane', pat: 'oh' }],
		});

		await store.delete('jane');
		assert.deepStrictEqual(store.get('joe'), undefined);
		assert.deepStrictEqual(store.get('jane'), undefined);
		assert.deepStrictEqual([...store], []);
		assert.deepStrictEqual(JSON.parse(fs.readFileSync(name, 'utf8')), {
			publishers: [],
		});

		fs.unlinkSync(name);
	});
});
