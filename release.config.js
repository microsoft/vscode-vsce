module.exports = {
	branches: ['main'],
	preset: 'conventionalcommits',
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				releaseRules: [
					{
						type: 'perf',
						release: 'patch',
					},
					{
						type: 'refactor',
						release: 'patch',
					},
					{
						type: 'build',
						scope: 'deps',
						release: 'patch',
					},
				],
			},
		],
		[
			'@semantic-release/release-notes-generator',
			{
				presetConfig: {
					types: [
						{
							type: 'feat',
							section: 'Features',
						},
						{
							type: 'fix',
							section: 'Bug Fixes',
						},
						{
							type: 'perf',
							section: 'Performance Improvements',
						},
						{
							type: 'revert',
							section: 'Reverts',
						},
						{
							type: 'refactor',
							section: 'Code Refactoring',
						},
						{
							type: 'build',
							scope: 'deps',
							section: 'Dependencies',
						},
					],
				},
			},
		],
		[
			'@semantic-release/npm',
			{
				tarballDir: '.',
			},
		],
		[
			'@semantic-release/github',
			{
				assets: '*.tgz',
				addReleases: 'bottom',
			},
		],
	],
};
