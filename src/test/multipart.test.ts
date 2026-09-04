import * as assert from 'assert';
import { Readable } from 'stream';
import { createMultipartStream, MultipartPart, runWithStreamError } from '../multipart';

async function chunks(stream: Readable): Promise<(string | Buffer)[]> {
	const result: (string | Buffer)[] = [];

	for await (const chunk of stream) {
		result.push(chunk);
	}

	return result;
}

async function collect(stream: Readable): Promise<Buffer> {
	const collected = await chunks(stream);
	return Buffer.concat(collected.map(chunk => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'))));
}

function part(name: string, filename: string, contents: string | Buffer): MultipartPart {
	return { name, filename, stream: Readable.from([contents]) };
}

function header(boundary: string, name: string, filename: string): string {
	return (
		`--${boundary}\r\n` +
		`Content-Disposition: attachment; name=${name}; filename="${filename}"\r\n` +
		`Content-Type: application/octet-stream\r\n\r\n`
	);
}

describe('createMultipartStream', () => {
	it('creates a multipart stream', async () => {
		const stream = createMultipartStream(
			[part('first', 'first.bin', 'first contents'), part('second', 'second.bin', 'second contents')],
			'boundary'
		);

		assert.strictEqual(
			(await collect(stream)).toString('utf8'),
			header('boundary', 'first', 'first.bin') +
				'first contents\r\n' +
				header('boundary', 'second', 'second.bin') +
				'second contents\r\n--boundary--\r\n'
		);
	});

	// Every emitted chunk is written to the request on its own, so this keeps the body to a few
	// large chunks rather than one per header line.
	it('emits one chunk per header, body chunk and part footer', async () => {
		const stream = createMultipartStream(
			[
				{ name: 'first', filename: 'first.bin', stream: Readable.from(['one', 'two']) },
				part('second', 'second.bin', 'second contents'),
			],
			'boundary'
		);

		assert.deepStrictEqual(await chunks(stream), [
			header('boundary', 'first', 'first.bin'),
			'one',
			'two',
			'\r\n',
			header('boundary', 'second', 'second.bin'),
			'second contents',
			'\r\n',
			'--boundary--\r\n',
		]);
	});

	it('preserves binary contents verbatim', async () => {
		const contents = Buffer.from([0x00, 0xff, 0x0d, 0x0a, 0x2d, 0x2d, 0x80, 0xfe]);
		const stream = createMultipartStream([part('vsix', 'vsix.bin', contents)], 'boundary');

		const expected = Buffer.concat([
			Buffer.from(header('boundary', 'vsix', 'vsix.bin'), 'utf8'),
			contents,
			Buffer.from('\r\n--boundary--\r\n', 'utf8'),
		]);

		assert.ok((await collect(stream)).equals(expected));
	});

	it('handles empty contents', async () => {
		const stream = createMultipartStream([part('vsix', 'vsix.bin', Buffer.alloc(0))], 'boundary');

		assert.strictEqual(
			(await collect(stream)).toString('utf8'),
			header('boundary', 'vsix', 'vsix.bin') + '\r\n--boundary--\r\n'
		);
	});

	it('handles no parts', async () => {
		assert.strictEqual((await collect(createMultipartStream([], 'boundary'))).toString('utf8'), '--boundary--\r\n');
	});

	it('leaves filenames that need no escaping untouched', async () => {
		const filename = "publisher.extension-1.0.0 (win32-x64); v1's.vsix";
		const stream = createMultipartStream([part('vsix', filename, 'contents')], 'boundary');

		assert.ok((await collect(stream)).toString('utf8').includes(`filename="${filename}"`));
	});

	it('escapes characters that would break out of the header', async () => {
		const stream = createMultipartStream(
			[part('vsix', 'quote".vsix', 'first'), part('sigzip', 'crlf\r\ninjected: header.zip', 'second')],
			'boundary'
		);

		const contents = (await collect(stream)).toString('utf8');

		assert.ok(contents.includes('filename="quote%22.vsix"'));
		assert.ok(contents.includes('filename="crlf%0D%0Ainjected: header.zip"'));
		assert.strictEqual(contents.split('\r\n').filter(line => line.startsWith('--boundary')).length, 3);
	});

	it('does not emit close once the stream ends', async () => {
		const stream = createMultipartStream([part('vsix', 'vsix.bin', 'contents')], 'boundary');
		let closed = false;

		stream.on('close', () => (closed = true));
		await collect(stream);
		await new Promise(resolve => setTimeout(resolve, 10));

		assert.strictEqual(closed, false);
	});

	it('propagates errors emitted before a part is consumed', async () => {
		const error = new Error('failed to read');
		const failedStream = new Readable({ read() {} });
		const stream = createMultipartStream(
			[part('first', 'first.bin', 'first contents'), { name: 'second', filename: 'second.bin', stream: failedStream }],
			'boundary'
		);

		failedStream.destroy(error);

		await assert.rejects(collect(stream), actual => actual === error);
	});

	it('propagates errors emitted while a part is consumed', async () => {
		const error = new Error('failed to read');
		const stream = createMultipartStream(
			[
				{
					name: 'vsix',
					filename: 'vsix.bin',
					stream: Readable.from(
						(async function* () {
							yield 'partial contents';
							throw error;
						})()
					),
				},
			],
			'boundary'
		);

		await assert.rejects(collect(stream), actual => actual === error);
	});

	it('destroys every part once the stream is consumed', async () => {
		const parts = [part('first', 'first.bin', 'first contents'), part('second', 'second.bin', 'second contents')];

		await collect(createMultipartStream(parts, 'boundary'));

		assert.deepStrictEqual(parts.map(p => p.stream.destroyed), [true, true]);
	});

	it('destroys parts that are never consumed because an earlier part failed', async () => {
		const failedStream = new Readable({ read() {} });
		const unconsumed = new Readable({ read() {} });
		const stream = createMultipartStream(
			[
				{ name: 'first', filename: 'first.bin', stream: failedStream },
				{ name: 'second', filename: 'second.bin', stream: unconsumed },
			],
			'boundary'
		);

		failedStream.destroy(new Error('failed to read'));
		await assert.rejects(collect(stream));

		assert.strictEqual(unconsumed.destroyed, true);
	});

	it('destroys every part when the consumer stops reading', async () => {
		const parts = [
			{ name: 'first', filename: 'first.bin', stream: new Readable({ read() { this.push('contents'); } }) },
			{ name: 'second', filename: 'second.bin', stream: new Readable({ read() { this.push('contents'); } }) },
		];
		const stream = createMultipartStream(parts, 'boundary');

		for await (const _ of stream) {
			break;
		}

		await new Promise(resolve => setImmediate(resolve));
		assert.deepStrictEqual(parts.map(p => p.stream.destroyed), [true, true]);
	});

	it('destroys every part when the stream is destroyed before it is read', async () => {
		const parts = [part('first', 'first.bin', 'first contents'), part('second', 'second.bin', 'second contents')];
		const stream = createMultipartStream(parts, 'boundary');

		stream.destroy();

		await new Promise(resolve => setImmediate(resolve));
		assert.deepStrictEqual(parts.map(p => p.stream.destroyed), [true, true]);
	});
});

describe('runWithStreamError', () => {
	it('resolves with the result of the operation', async () => {
		const stream = createMultipartStream([part('vsix', 'vsix.bin', 'contents')], 'boundary');

		assert.strictEqual(await runWithStreamError(stream, async () => 'result'), 'result');
	});

	it('rejects with the error of the operation', async () => {
		const error = new Error('request failed');
		const stream = createMultipartStream([part('vsix', 'vsix.bin', 'contents')], 'boundary');

		await assert.rejects(
			runWithStreamError(stream, async () => {
				throw error;
			}),
			actual => actual === error
		);
	});

	it('rejects an operation that never settles when the multipart stream errors', async () => {
		const error = new Error('failed to read');
		const failedStream = Readable.from(
			(async function* () {
				yield 'partial contents';
				throw error;
			})()
		);
		const stream = createMultipartStream([{ name: 'vsix', filename: 'vsix.bin', stream: failedStream }], 'boundary');

		await assert.rejects(
			runWithStreamError(stream, () => {
				stream.resume();
				return new Promise<never>(() => {});
			}),
			actual => actual === error
		);
	});

	it('keeps handling stream errors that arrive after the operation settles', async () => {
		const failedStream = new Readable({ read() {} });
		const stream = createMultipartStream([{ name: 'vsix', filename: 'vsix.bin', stream: failedStream }], 'boundary');

		stream.resume();
		assert.strictEqual(await runWithStreamError(stream, async () => 'result'), 'result');

		// Without a listener this would be an unhandled 'error' event, which terminates the process.
		assert.ok(stream.listenerCount('error') > 0);
		failedStream.destroy(new Error('failed to read'));
		await new Promise(resolve => setTimeout(resolve, 10));
	});
});
