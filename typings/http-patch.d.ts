declare module 'http' {
	export interface ClientResponse extends IncomingMessage {}
}