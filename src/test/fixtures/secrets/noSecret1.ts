export const k = {
	'type': 'service_account',
	'project_id': 'my-gcp-project',
	'private_key_id': 'abcdef1234567890abcdef1234567890abcdef12',
	'private_key': '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq...\n-----END PRIVATE KEY-----\n',
	'client_email': 'my-service-account@my-gcp-project.iam.gserviceaccount.com',
	'client_id': '123456789012345678901',
	'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
	'token_uri': 'https://oauth2.googleapis.com/token',
	'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
	'client_x509_cert_url': 'https://www.googleapis.com/robot/v1/metadata/x509/my-service-account%40my-gcp-project.iam.gserviceaccount.com'
};

// Here a Fibonacci sequence function
export function fib(n: number): number {
	if (n <= 1) return n;
	return fib(n - 1) + fib(n - 2);
}