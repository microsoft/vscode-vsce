import { Promise } from 'q';

export function fatal(message: any, ...args: any[]) {
	if (message instanceof Error && /^cancell?ed$/i.test(message.message)) {
		return;
	}
	
	console.error('Error:', message, ...args);
	process.exit(1);
}