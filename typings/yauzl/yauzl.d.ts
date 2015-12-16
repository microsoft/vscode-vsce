declare module 'yauzl' {
	import * as stream from 'stream';
	import * as events from 'events';

  interface Entry {
    fileName: string;
  }

	class ZipFile extends events.EventEmitter {
    openReadStream(entry: Entry, cb: (err: Error, stream: stream.Readable) => void);
	}

  function open(path: string, callback: (err: Error, zipfile: ZipFile) => void);
}