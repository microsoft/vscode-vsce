import { Entry, open, ZipFile } from 'yauzl';
import { Manifest } from './manifest';
import { parseXmlManifest, XMLManifest } from './xml';

function readEntryString(zipfile: ZipFile, entry: Entry, cb: (err: Error, result?: string) => void): void {
	zipfile.openReadStream(entry, (err, stream) => {
		if (err) {
			return cb(err);
		}

		const buffers = [];
		stream.on('data', buffer => buffers.push(buffer));
		stream.once('error', cb);
		stream.once('end', () => {
			try {
				cb(null, Buffer.concat(buffers).toString('utf8'));
			} catch (err) {
				cb(err);
			}
		});
	});
}

export function readVSIXPackage(packagePath: string): Promise<{ manifest: Manifest; xmlManifest: XMLManifest }> {
	return new Promise<{ manifest: Manifest; xmlManifest: XMLManifest }>((c, e) => {
		open(packagePath, (err, zipfile) => {
			if (err) {
				return e(err);
			}

			let manifest: Manifest | undefined;
			let xmlManifest: XMLManifest | undefined;

			zipfile.once('close', () => {
				if (!manifest) {
					e(new Error('Manifest not found'));
				} else if (!xmlManifest) {
					e(new Error('VSIX manifest not found'));
				} else {
					c({ manifest, xmlManifest });
				}
			});

			zipfile.on('entry', (entry: Entry) => {
				switch (entry.fileName.toLowerCase()) {
					case 'extension/package.json': {
						return readEntryString(zipfile, entry, (err, result) => {
							if (err) {
								zipfile.close();
								return e(err);
							}

							manifest = JSON.parse(result);
						});
					}
					case 'extension.vsixmanifest': {
						return readEntryString(zipfile, entry, (err, result) => {
							if (err) {
								zipfile.close();
								return e(err);
							}

							parseXmlManifest(result).then(r => (xmlManifest = r));
						});
					}
				}
			});
		});
	});
}
