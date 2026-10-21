import * as assert from 'assert';
import { createServer, IncomingHttpHeaders, Server } from 'http';
import { AddressInfo } from 'net';
import { GalleryApi } from 'azure-devops-node-api/GalleryApi';
import { CI_PROVIDER_HEADER, CIProvider, CIProviderRequestHandler, detectCIProvider, isGitHubActions } from '../ciProvider';

describe('detectCIProvider', () => {
	const cases: [NodeJS.ProcessEnv, CIProvider][] = [
		[{}, CIProvider.None],
		[{ GITHUB_ACTIONS: 'true' }, CIProvider.GitHubActions],
		[{ TF_BUILD: 'True' }, CIProvider.AzurePipelines],
		[{ SYSTEM_TEAMPROJECTID: '00000000-0000-0000-0000-000000000000' }, CIProvider.AzurePipelines],
		[{ GITLAB_CI: 'true' }, CIProvider.GitLabCI],
		[{ BITBUCKET_PIPELINE_UUID: '{uuid}' }, CIProvider.BitbucketPipelines],
		[{ JENKINS_URL: 'https://jenkins.example/' }, CIProvider.Jenkins],
		[{ CIRCLECI: 'true' }, CIProvider.CircleCI],
		[{ TRAVIS: 'true' }, CIProvider.TravisCI],
		[{ APPVEYOR: 'True' }, CIProvider.AppVeyor],
		[{ TEAMCITY_VERSION: '2024.12' }, CIProvider.TeamCity],
		[{ bamboo_buildKey: 'PROJ-PLAN-JOB1' }, CIProvider.Bamboo],
		[{ 'bamboo.buildKey': 'PROJ-PLAN-JOB1' }, CIProvider.Bamboo],
		[{ JB_SPACE_EXECUTION_NUMBER: '42' }, CIProvider.JetBrainsSpace],
		[{ BUILDKITE: 'true' }, CIProvider.Buildkite],
		[{ CODEBUILD_BUILD_ID: 'project:build-id' }, CIProvider.AWSCodeBuild],
		[{ CI: 'true' }, CIProvider.Other],
		[{ CI: '1' }, CIProvider.Other],
		[{ CI: 'woodpecker' }, CIProvider.Other],
		[{ CI: 'false' }, CIProvider.None],
		[{ CI: '0' }, CIProvider.None],
		[{ CI: '' }, CIProvider.None],
		[{ GITHUB_ACTIONS: 'false' }, CIProvider.None],
		[{ TRAVIS: 'false' }, CIProvider.None],
	];

	for (const [environment, expected] of cases) {
		it(`detects '${expected}' for ${JSON.stringify(environment)}`, () => {
			assert.strictEqual(detectCIProvider(environment), expected);
		});
	}

	it('prefers a specific provider over the generic CI variable', () => {
		assert.strictEqual(detectCIProvider({ CI: 'true', GITLAB_CI: 'true' }), CIProvider.GitLabCI);
	});

	it('prefers GitHub Actions when multiple providers are detected', () => {
		assert.strictEqual(detectCIProvider({ TF_BUILD: 'True', GITHUB_ACTIONS: 'true' }), CIProvider.GitHubActions);
	});

	it('detects GitHub Actions', () => {
		assert.strictEqual(isGitHubActions({ GITHUB_ACTIONS: 'true' }), true);
		assert.strictEqual(isGitHubActions({ GITHUB_ACTIONS: 'TRUE' }), true);
		assert.strictEqual(isGitHubActions({ GITLAB_CI: 'true' }), false);
		assert.strictEqual(isGitHubActions({}), false);
	});
});

describe('CIProviderRequestHandler', () => {
	it('adds the CI provider header to object headers', () => {
		const options = { headers: { accept: 'application/json' } };
		new CIProviderRequestHandler(CIProvider.GitLabCI).prepareRequest(options);
		assert.deepStrictEqual(options.headers, { accept: 'application/json', [CI_PROVIDER_HEADER]: 'gitlab-ci' });
	});

	it('adds the CI provider header to raw headers', () => {
		const options: { headers: readonly string[] } = { headers: ['accept', 'application/json'] };
		new CIProviderRequestHandler(CIProvider.None).prepareRequest(options);
		assert.deepStrictEqual(options.headers, ['accept', 'application/json', CI_PROVIDER_HEADER, 'none']);
	});

	it('sends the CI provider header with Marketplace gallery requests', async () => {
		const received: IncomingHttpHeaders[] = [];
		const server = createServer((req, res) => {
			received.push(req.headers);
			res.writeHead(404, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ message: 'not found' }));
		});

		await listen(server);

		try {
			const { port } = server.address() as AddressInfo;
			const api = new GalleryApi(`http://127.0.0.1:${port}`, [new CIProviderRequestHandler(CIProvider.AzurePipelines)]);
			await api.getExtension(null, 'publisher', 'extension').catch(() => undefined);
		} finally {
			await new Promise(resolve => server.close(resolve));
		}

		assert.ok(received.length > 0, 'Expected at least one request');
		for (const headers of received) {
			assert.strictEqual(headers[CI_PROVIDER_HEADER.toLowerCase()], 'azure-pipelines');
		}
	});
});

function listen(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
}
