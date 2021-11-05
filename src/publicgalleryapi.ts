import { HttpClient, HttpClientResponse } from 'typed-rest-client/HttpClient';
import {
	PublishedExtension,
	ExtensionQueryFlags,
	FilterCriteria,
	ExtensionQueryFilterType,
	TypeInfo,
} from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { IHeaders } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
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
	private readonly client = new HttpClient('vsce');

	constructor(private baseUrl: string, private apiVersion = '3.0-preview.1') {}

	private post(url: string, data: string, additionalHeaders?: IHeaders): Promise<HttpClientResponse> {
		return this.client.post(`${this.baseUrl}/_apis/public${url}`, data, additionalHeaders);
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
		const raw = JSON.parse(await res.readBody());

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
