export function validatePublisher(publisher: string): void {
	if (!publisher) {
		throw new Error(`Missing publisher name`);
	}
	
	if (!/^[a-z0-9\-]+$/i.test(publisher)) {
		throw new Error(`Invalid publisher '${ publisher }'`);
	}
}