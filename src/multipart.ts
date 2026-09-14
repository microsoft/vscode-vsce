import { Readable } from 'stream';

export interface MultipartPart {
	name: string;
	filename: string;
	stream: Readable;
}

function escapeHeaderParameter(value: string): string {
	return value.replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22');
}

export function createMultipartStream(parts: readonly MultipartPart[], boundary: string): Readable {
	const lineBreak = '\r\n';

	for (const part of parts) {
		// A part can fail before it is reached. Readable stores the error and its async iterator
		// rethrows it when the part is consumed; this listener just keeps it from being unhandled.
		part.stream.on('error', () => {});
	}

	const destroyParts = () => {
		for (const part of parts) {
			part.stream.destroy();
		}
	};

	const stream = Readable.from(
		(async function* () {
			try {
				for (const part of parts) {
					yield `--${boundary}${lineBreak}` +
						`Content-Disposition: attachment; name=${escapeHeaderParameter(part.name)}; filename="${escapeHeaderParameter(part.filename)}"${lineBreak}` +
						`Content-Type: application/octet-stream${lineBreak}${lineBreak}`;
					yield* part.stream;
					yield lineBreak;
				}

				yield `--${boundary}--${lineBreak}`;
			} finally {
				// Parts after a failed or abandoned one are never consumed, so release them here.
				destroyParts();
			}
		})(),
		// Without this the stream emits 'close' once it ends, which makes consumers that treat
		// 'close' as "the body is complete" end the underlying request a second time.
		{ autoDestroy: false }
	);

	// The generator body, and therefore its `finally`, never runs if the stream is destroyed
	// before anything is read from it.
	stream.on('close', destroyParts);

	return stream;
}

export function runWithStreamError<T>(stream: Readable, operation: () => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		// This listener is deliberately never removed. An error arriving after the operation has
		// settled would otherwise be an unhandled 'error' event, which terminates the process.
		// Settling a promise more than once is a no-op, so the first outcome wins.
		stream.on('error', reject);
		Promise.resolve().then(operation).then(resolve, reject);
	});
}
