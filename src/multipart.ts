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

	return Readable.from(
		(async function* () {
			for (const part of parts) {
				yield `--${boundary}${lineBreak}`;
				yield `Content-Disposition: attachment; name=${escapeHeaderParameter(part.name)}; filename="${escapeHeaderParameter(part.filename)}"${lineBreak}`;
				yield `Content-Type: application/octet-stream${lineBreak}${lineBreak}`;
				yield* part.stream;
				yield lineBreak;
			}

			yield `--${boundary}--${lineBreak}`;
		})()
	);
}
