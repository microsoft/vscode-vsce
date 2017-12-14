declare module 'yazl' {
	import * as stream from 'stream';
	
	class ZipFile {
		outputStream: stream.Stream;
		addBuffer(buffer: Buffer, path: string, options: any);
		addFile(localPath: string, path: string, options: any);
		end();
	}
}