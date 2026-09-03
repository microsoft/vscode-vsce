import * as assert from 'assert';
import { Readable } from 'stream';
import { createMultipartStream } from '../multipart';

describe('createMultipartStream', () => {
	it('creates a multipart stream', async () => {
		const stream = createMultipartStream(
			[
				{ name: 'first', filename: 'first.bin', stream: Readable.from(['first contents']) },
				{ name: 'second', filename: 'second.bin', stream: Readable.from(['second contents']) },
			],
			'boundary'
		);
		let contents = '';

		for await (const chunk of stream) {
			contents += chunk;
		}

		assert.strictEqual(
			contents,
			[
				'--boundary',
				'Content-Disposition: attachment; name=first; filename="first.bin"',
				'Content-Type: application/octet-stream',
				'',
				'first contents',
				'--boundary',
				'Content-Disposition: attachment; name=second; filename="second.bin"',
				'Content-Type: application/octet-stream',
				'',
				'second contents',
				'--boundary--',
				'',
			].join('\r\n')
		);
	});
});
