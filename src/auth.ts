import { AzureCliCredential, AzureDeveloperCliCredential, AzurePowerShellCredential, ChainedTokenCredential, EnvironmentCredential, ManagedIdentityCredential } from "@azure/identity";

function createChainedTokenCredential(): ChainedTokenCredential {
	return new ChainedTokenCredential(
		new EnvironmentCredential(),
		new AzureCliCredential(),
		new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID }),
		new AzurePowerShellCredential({ tenantId: process.env.AZURE_TENANT_ID }),
		new AzureDeveloperCliCredential({ tenantId: process.env.AZURE_TENANT_ID })
	);
}

export async function getAzureCredentialAccessToken(): Promise<string> {
	try {
		const credential = createChainedTokenCredential()
		const token = await credential.getToken('499b84ac-1321-427f-aa17-267ca6975798/.default', {
			tenantId: process.env.AZURE_TENANT_ID
		});

		return token.token;
	} catch (error) {
		throw new Error('Can not acquire a Microsoft Entra ID access token. Additional information:\n\n' + error)
	}
}
