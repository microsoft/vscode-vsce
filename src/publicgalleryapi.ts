import { HttpClient, HttpClientResponse } from 'typed-rest-client/HttpClient';
import { PublishedExtension, ExtensionQueryFlags, FilterCriteria, ExtensionQueryFilterType, TypeInfo } from 'azure-devops-node-api/interfaces/GalleryInterfaces';
import { IHeaders } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import { ContractSerializer } from 'azure-devops-node-api/Serialization';

export interface ExtensionQuery {
	readonly pageNumber?: number;
	readonly pageSize?: number;
	readonly flags?: ExtensionQueryFlags[];
	readonly criteria?: FilterCriteria[];
	readonly assetTypes?: string[];
}

export interface IExtensionsReport {
	malicious: string[];
	web: {
		publishers: string[],
		extensions: string[],
	};
}

export class PublicGalleryAPI {

	private readonly extensionsReportUrl = 'https://az764295.vo.msecnd.net/extensions/marketplace.json';
	private readonly client = new HttpClient('vsce');

	constructor(private baseUrl: string, private apiVersion = '3.0-preview.1') { }

	private post(url: string, data: string, additionalHeaders?: IHeaders): Promise<HttpClientResponse> {
		return this.client.post(`${this.baseUrl}/_apis/public${url}`, data, additionalHeaders);
	}

	async extensionQuery({
		pageNumber = 1,
		pageSize = 1,
		flags = [],
		criteria = [],
		assetTypes = [],
	}: ExtensionQuery): Promise<PublishedExtension[]> {
		const data = JSON.stringify({
			filters: [{ pageNumber, pageSize, criteria }],
			assetTypes,
			flags: flags.reduce((memo, flag) => memo | flag, 0)
		});

		const res = await this.post('/gallery/extensionquery', data, { Accept: `application/json;api-version=${this.apiVersion}`, 'Content-Type': 'application/json', });
		const raw = JSON.parse(await res.readBody());

		return ContractSerializer.deserialize(raw.results[0].extensions, TypeInfo.PublishedExtension, false, false);
	}

	async getExtension(extensionId: string, flags: ExtensionQueryFlags[] = []): Promise<PublishedExtension> {
		const query = { criteria: [{ filterType: ExtensionQueryFilterType.Name, value: extensionId }], flags, };
		const extensions = await this.extensionQuery(query);
		return extensions.filter(({ publisher: { publisherName: publisher }, extensionName: name }) => extensionId.toLowerCase() === `${publisher}.${name}`.toLowerCase())[0];
	}

	async getExtensionsReport(): Promise<IExtensionsReport> {
		const res = await this.client.get(this.extensionsReportUrl);
		const raw = <Partial<IExtensionsReport>>JSON.parse(await res.readBody());
		return {
			malicious: raw.malicious || [],
			web: raw.web || { publishers: [], extensions: [] }
		}
	}
}
