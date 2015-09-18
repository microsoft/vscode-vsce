declare module "read" {
	import { Readable, Writable } from 'stream';
	
	function read(options: read.Options, callback: read.Callback): void;
	
	module read {
		interface Options {
			prompt?: string;
			silent?: boolean;
			replace?: string;
			timeout?: number;
			default?: string;
			edit?: boolean;
			terminal?: boolean;
			input?: Readable;
			output?: Writable;
		}
		
		interface Callback {
			(error: Error, result: string, isDefault: boolean): void;
		}
	}
	
	export = read;
}
