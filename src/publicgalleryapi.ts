import { HttpClient, HttpClientResponse } from 'vso-node-api/HttpClient';
import { PublishedExtension, ExtensionQueryFlags, FilterCriteria, SortOrderType,
	SortByType, ExtensionQueryFilterType, TypeInfo} from 'vso-node-api/interfaces/GalleryInterfaces';
import { IHeaders } from 'vso-node-api/interfaces/common/VsoBaseInterfaces';
import { ContractSerializer } from 'vso-node-api/Serialization';

export interface ExtensionQuery {
	pageNumber?: number;
	pageSize?: number;
	sortBy?: SortByType;
	sortOrder?: SortOrderType;
	flags?: ExtensionQueryFlags[];
	criteria?: FilterCriteria[];
	assetTypes?: string[];
}

export class PublicGalleryAPI {
	client: HttpClient;

	constructor(public baseUrl: string, public apiVersion = '3.0-preview.1') {
		this.client = new HttpClient('vsce');
	}

	post(url: string, data: string, additionalHeaders?: IHeaders): Promise<HttpClientResponse> {
		return this.client.post(`${this.baseUrl}/_apis/public${url}`, data, additionalHeaders);
	}

	extensionQuery({
		pageNumber = 1,
		pageSize = 1,
		sortBy = SortByType.Relevance,
		sortOrder = SortOrderType.Default,
		flags = [],
		criteria = [],
		assetTypes = [],
	}: ExtensionQuery): Promise<PublishedExtension[]> {
		return this.post('/gallery/extensionquery', JSON.stringify({
			filters: [{pageNumber, pageSize, criteria}],
			assetTypes,
			flags: flags.reduce((memo, flag) => memo | flag, 0)
		}), {
			Accept: `application/json;api-version=${this.apiVersion}`,
			'Content-Type': 'application/json',
		})
			.then(res => res.readBody())
			.then(data => JSON.parse(data))
			.then(({results: [result = {}] = []}) => result)
			.then(({extensions = []}) =>
				ContractSerializer.deserialize(extensions, TypeInfo.PublishedExtension, false, false)
			);
	}

	getExtension(extensionId: string, flags: ExtensionQueryFlags[] = []): Promise<PublishedExtension> {
		return this.extensionQuery({
			criteria: [{ filterType: ExtensionQueryFilterType.Name, value: extensionId }],
			flags,
		})
		.then(result => result.filter(({publisher: {publisherName}, extensionName}) =>
			extensionId === `${publisherName}.${extensionName}`)
		)
		.then(([extension]) => extension);
	}
}
