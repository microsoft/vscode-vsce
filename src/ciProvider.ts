import type { RequestOptions } from 'http';
import type {
	IHttpClient,
	IHttpClientResponse,
	IRequestHandler,
	IRequestInfo,
} from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';

/**
 * Well-known CI provider identifiers reported to the Marketplace via {@link CI_PROVIDER_HEADER}.
 * The Marketplace aggregates on these values, so existing values must never change.
 */
export const CIProvider = {
	GitHubActions: 'github-actions',
	AzurePipelines: 'azure-pipelines',
	GitLabCI: 'gitlab-ci',
	BitbucketPipelines: 'bitbucket-pipelines',
	Jenkins: 'jenkins',
	CircleCI: 'circleci',
	TravisCI: 'travis-ci',
	AppVeyor: 'appveyor',
	TeamCity: 'teamcity',
	Bamboo: 'bamboo',
	JetBrainsSpace: 'jetbrains-space',
	Buildkite: 'buildkite',
	AWSCodeBuild: 'aws-codebuild',
	/** A CI system was detected through the generic `CI` variable but isn't one of the known providers. */
	Other: 'other',
	/** No CI system was detected, e.g. a manual publish from a developer machine. */
	None: 'none',
} as const;

export type CIProvider = (typeof CIProvider)[keyof typeof CIProvider];

export const CI_PROVIDER_HEADER = 'X-Market-CI-Provider';

type Environment = NodeJS.ProcessEnv;

interface ICIProviderDetector {
	readonly provider: CIProvider;
	isActive(environment: Environment): boolean;
}

function hasValue(environment: Environment, name: string): boolean {
	return !!environment[name];
}

function isTrue(environment: Environment, name: string): boolean {
	return environment[name]?.toLowerCase() === 'true';
}

// Ordered by precedence: the first matching detector wins. Detection is based on the variables
// each provider documents, see also https://github.com/dotnet/Nerdbank.GitVersioning/tree/main/src/NerdBank.GitVersioning/CloudBuildServices
const detectors: readonly ICIProviderDetector[] = [
	// https://docs.github.com/actions/reference/variables-reference#default-environment-variables
	{ provider: CIProvider.GitHubActions, isActive: env => isTrue(env, 'GITHUB_ACTIONS') },
	// https://learn.microsoft.com/azure/devops/pipelines/build/variables#system-variables
	{ provider: CIProvider.AzurePipelines, isActive: env => isTrue(env, 'TF_BUILD') || hasValue(env, 'SYSTEM_TEAMPROJECTID') },
	// https://docs.gitlab.com/ci/variables/predefined_variables/
	{ provider: CIProvider.GitLabCI, isActive: env => hasValue(env, 'GITLAB_CI') },
	// https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/
	{ provider: CIProvider.BitbucketPipelines, isActive: env => hasValue(env, 'BITBUCKET_PIPELINE_UUID') },
	// https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#using-environment-variables
	{ provider: CIProvider.Jenkins, isActive: env => hasValue(env, 'JENKINS_URL') },
	// https://circleci.com/docs/variables/#built-in-environment-variables
	{ provider: CIProvider.CircleCI, isActive: env => isTrue(env, 'CIRCLECI') },
	// https://docs.travis-ci.com/user/environment-variables/#default-environment-variables
	{ provider: CIProvider.TravisCI, isActive: env => isTrue(env, 'TRAVIS') },
	// https://www.appveyor.com/docs/environment-variables/
	{ provider: CIProvider.AppVeyor, isActive: env => hasValue(env, 'APPVEYOR') },
	// https://www.jetbrains.com/help/teamcity/predefined-build-parameters.html
	{ provider: CIProvider.TeamCity, isActive: env => hasValue(env, 'TEAMCITY_VERSION') },
	// https://confluence.atlassian.com/bamboo/bamboo-variables-289277087.html
	{ provider: CIProvider.Bamboo, isActive: env => hasValue(env, 'bamboo_buildKey') || hasValue(env, 'bamboo.buildKey') },
	// https://www.jetbrains.com/help/space/automation-environment-variables.html
	{ provider: CIProvider.JetBrainsSpace, isActive: env => hasValue(env, 'JB_SPACE_EXECUTION_NUMBER') },
	// https://buildkite.com/docs/pipelines/configure/environment-variables
	{ provider: CIProvider.Buildkite, isActive: env => isTrue(env, 'BUILDKITE') },
	// https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
	{ provider: CIProvider.AWSCodeBuild, isActive: env => hasValue(env, 'CODEBUILD_BUILD_ID') },
];

function isGenericCI(environment: Environment): boolean {
	const value = environment['CI']?.toLowerCase();
	return !!value && value !== 'false' && value !== '0';
}

/**
 * Best-effort detection of the CI system `vsce` is running in. This is a rough signal for
 * statistics only and is trivially spoofable, so it must never be used for security decisions.
 */
export function detectCIProvider(environment: Environment = process.env): CIProvider {
	const detector = detectors.find(candidate => candidate.isActive(environment));

	if (detector) {
		return detector.provider;
	}

	return isGenericCI(environment) ? CIProvider.Other : CIProvider.None;
}

export function isGitHubActions(environment: Environment = process.env): boolean {
	return detectCIProvider(environment) === CIProvider.GitHubActions;
}

/**
 * Adds the {@link CI_PROVIDER_HEADER} header to every request sent through an
 * `azure-devops-node-api` client.
 */
export class CIProviderRequestHandler implements IRequestHandler {
	constructor(readonly provider: CIProvider = detectCIProvider()) {}

	prepareRequest(options: RequestOptions): void {
		if (Array.isArray(options.headers)) {
			options.headers = [...options.headers, CI_PROVIDER_HEADER, this.provider];
		} else {
			options.headers = { ...options.headers, [CI_PROVIDER_HEADER]: this.provider };
		}
	}

	canHandleAuthentication(): boolean {
		return false;
	}

	handleAuthentication(_httpClient: IHttpClient, _requestInfo: IRequestInfo, _objs: any): Promise<IHttpClientResponse> {
		throw new Error('CIProviderRequestHandler does not handle authentication.');
	}
}
