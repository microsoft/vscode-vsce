import { Promise, nfcall } from 'q';
import { assign } from 'lodash';
import _read = require('read');

export function fatal(message: any, ...args: any[]) {
	if (message instanceof Error && /^cancell?ed$/i.test(message.message)) {
		return;
	}
	
	console.error('Error:', message, ...args);
	process.exit(1);
}

export function read(prompt: string, options: _read.Options = {}): Promise<string> {
	return nfcall<string>(_read, assign({ prompt }, options))
		.spread(r => r);
}