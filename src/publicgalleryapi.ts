import {
	PublishedExtension,
	ExtensionQueryFlags,
	FilterCriteria,
	ExtensionQueryFilterType,
	TypeInfo,
} from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { ContractSerializer } from 'azure-devops-node-api/Serialization';

export interface ExtensionQuery {
	readonly pageNumber?: number;
	readonly pageSize?: number;
	readonly flags?: ExtensionQueryFlags[];
	readonly criteria?: FilterCriteria[];
	readonly assetTypes?: string[];
}

interface VSCodePublishedExtension extends PublishedExtension {
	publisher: { displayName: string; publisherName: string };
}

export class PublicGalleryAPI {
	constructor(private baseUrl: string, private apiVersion = '3.0-preview.1') {}

	private post(url: string, data: string, additionalHeaders?: Record<string, string>): Promise<Response> {
		return fetch(`${this.baseUrl}/_apis/public${url}`, {
			method: 'POST',
			// typed-rest-client's HttpClient('vsce') sent this user agent
			headers: { 'User-Agent': 'vsce', ...additionalHeaders },
			body: data,
		});
	}

	async extensionQuery({
		pageNumber = 1,
		pageSize = 1,
		flags = [],
		criteria = [],
		assetTypes = [],
	}: ExtensionQuery): Promise<VSCodePublishedExtension[]> {
		const data = JSON.stringify({
			filters: [{ pageNumber, pageSize, criteria }],
			assetTypes,
			flags: flags.reduce((memo, flag) => memo | flag, 0),
		});

		const res = await this.post('/gallery/extensionquery', data, {
			Accept: `application/json;api-version=${this.apiVersion}`,
			'Content-Type': 'application/json',
		});
		const body = await res.text();

		if (!res.ok) {
			// Prefer the gallery's own error message when the body carries one
			let message: string | undefined;
			try {
				message = JSON.parse(body).message;
			} catch {
				// non-JSON error body
			}
			throw new Error(message ?? `Gallery request failed: ${res.status} ${res.statusText}`);
		}

		const raw = JSON.parse(body);

		if (raw.errorCode !== undefined) {
			throw new Error(raw.message);
		}

		return ContractSerializer.deserialize(raw.results[0].extensions, TypeInfo.PublishedExtension, false, false);
	}

	async getExtension(extensionId: string, flags: ExtensionQueryFlags[] = []): Promise<PublishedExtension> {
		const query = { criteria: [{ filterType: ExtensionQueryFilterType.Name, value: extensionId }], flags };
		const extensions = await this.extensionQuery(query);
		return extensions.filter(
			({ publisher: { publisherName: publisher }, extensionName: name }) =>
				extensionId.toLowerCase() === `${publisher}.${name}`.toLowerCase()
		)[0];
	}
}
