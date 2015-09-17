export function fatal(message: string, ...args: any[]) {
	console.error(message, ...args);
	process.exit(1);
}