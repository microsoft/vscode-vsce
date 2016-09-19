declare module 'yazl' {
	import * as stream from 'stream';
	
	class ZipFile {
		outputStream: stream.Stream;
		addBuffer(buffer: Buffer, path: string);
		addFile(localPath: string, path: string);
		end();
	}
}