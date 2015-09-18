export function fatal(message: string, ...args: any[]) {
	console.error('Error:', message, ...args);
	process.exit(1);
}