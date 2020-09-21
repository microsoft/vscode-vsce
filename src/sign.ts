import * as fs from 'fs';
import * as crypto from 'crypto';
import { IFile, isInMemoryFile } from './util';

export type Checksum = Map<IFile, string>;

async function checksumFile(file: IFile): Promise<string> {
	const hash = crypto.createHash('sha256');

	if (isInMemoryFile(file)) {
		hash.write(file.contents);
		return hash.digest('base64');
	} else {
		return await new Promise((c, e) => {
			const stream = fs.createReadStream(file.localPath);

			stream
				.pipe(hash)
				.on('error', err => e(err))
				.on('data', (data: Buffer) => c(data.toString('base64')));
		});
	}
}

export async function createChecksumFile(files: IFile[]): Promise<IFile> {
	const lines: string[] = [];

	for (const file of files) {
		lines.push(`${await checksumFile(file)} ${file.path}\n`);
	}

	return { path: 'checksum', contents: lines.join('') };
}

	return { path: 'checksum', contents: contents.join('\n') };
}
