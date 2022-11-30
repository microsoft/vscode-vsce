import program from 'commander';
import leven from 'leven';
import { packageCommand, ls, Targets } from './package';
import { publish, unpublish } from './publish';
import { show } from './show';
import { search } from './search';
import { listPublishers, deletePublisher, loginPublisher, logoutPublisher, verifyPat } from './store';
import { getLatestVersion } from './npm';
import { CancellationToken, log } from './util';
import * as semver from 'semver';
import { isatty } from 'tty';

const pkg = require('../package.json');

function fatal(message: any, ...args: any[]): void {
	if (message instanceof Error) {
		message = message.message;

		if (/^cancell?ed$/i.test(message)) {
			return;
		}
	}

	log.error(message, ...args);

	if (/Unauthorized\(401\)/.test(message)) {
		log.error(`Be sure to use a Personal Access Token which has access to **all accessible accounts**.
See https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions for more information.`);
	}

	process.exit(1);
}

function main(task: Promise<any>): void {
	let latestVersion: string | null = null;

	const token = new CancellationToken();

	if (isatty(1)) {
		getLatestVersion(pkg.name, token)
			.then(version => (latestVersion = version))
			.catch(_ => {
				/* noop */
			});
	}

	task.catch(fatal).then(() => {
		if (latestVersion && semver.gt(latestVersion, pkg.version)) {
			log.info(
				`\nThe latest version of ${pkg.name} is ${latestVersion} and you have ${pkg.version}.\nUpdate it now: npm install -g ${pkg.name}`
			);
		} else {
			token.cancel();
		}
	});
}

const ValidTargets = [...Targets].join(', ');

module.exports = function (argv: string[]): void {
	program.version(pkg.version).usage('<command>');

	program
		.command('ls')
		.description('Lists all the files that will be published')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presence of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from lack of yarn.lock or .yarnrc)')
		.option<string[]>(
			'--packagedDependencies <path>',
			'Select packages that should be published only (includes dependencies)',
			(val, all) => (all ? all.concat(val) : [val]),
			undefined
		)
		.option('--ignoreFile <path>', 'Indicate alternative .vscodeignore')
		// default must remain undefined for dependencies or we will fail to load defaults from package.json
		.option('--dependencies', 'Enable dependency detection via npm or yarn', undefined)
		.option('--no-dependencies', 'Disable dependency detection via npm or yarn', undefined)
		.action(({ yarn, packagedDependencies, ignoreFile, dependencies }) =>
			main(ls({ useYarn: yarn, packagedDependencies, ignoreFile, dependencies }))
		);

	program
		.command('package [version]')
		.description('Packages an extension')
		.option('-o, --out <path>', 'Output .vsix extension file to <path> location (defaults to <name>-<version>.vsix)')
		.option('-t, --target <target>', `Target architecture. Valid targets: ${ValidTargets}`)
		.option('-m, --message <commit message>', 'Commit message used when calling `npm version`.')
		.option(
			'--no-git-tag-version',
			'Do not create a version commit and tag when calling `npm version`. Valid only when [version] is provided.'
		)
		.option('--no-update-package-json', 'Do not update `package.json`. Valid only when [version] is provided.')
		.option(
			'--githubBranch <branch>',
			'The GitHub branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option(
			'--gitlabBranch <branch>',
			'The GitLab branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option('--no-rewrite-relative-links', 'Skip rewriting relative links.')
		.option('--baseContentUrl <url>', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl <url>', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presence of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from lack of yarn.lock or .yarnrc)')
		.option('--ignoreFile <path>', 'Indicate alternative .vscodeignore')
		.option('--no-gitHubIssueLinking', 'Disable automatic expansion of GitHub-style issue syntax into links')
		.option('--no-gitLabIssueLinking', 'Disable automatic expansion of GitLab-style issue syntax into links')
		// default must remain undefined for dependencies or we will fail to load defaults from package.json
		.option('--dependencies', 'Enable dependency detection via npm or yarn', undefined)
		.option('--no-dependencies', 'Disable dependency detection via npm or yarn')
		.option('--pre-release', 'Mark this package as a pre-release')
		.option('--allow-star-activation', 'Allow using * in activation events')
		.option('--allow-missing-repository', 'Allow missing a repository URL in package.json')
		.action(
			(
				version,
				{
					out,
					target,
					message,
					gitTagVersion,
					updatePackageJson,
					githubBranch,
					gitlabBranch,
					rewriteRelativeLinks,
					baseContentUrl,
					baseImagesUrl,
					yarn,
					ignoreFile,
					gitHubIssueLinking,
					gitLabIssueLinking,
					dependencies,
					preRelease,
					allowStarActivation,
					allowMissingRepository,
				}
			) =>
				main(
					packageCommand({
						packagePath: out,
						version,
						target,
						commitMessage: message,
						gitTagVersion,
						updatePackageJson,
						githubBranch,
						gitlabBranch,
						rewriteRelativeLinks,
						baseContentUrl,
						baseImagesUrl,
						useYarn: yarn,
						ignoreFile,
						gitHubIssueLinking,
						gitLabIssueLinking,
						dependencies,
						preRelease,
						allowStarActivation,
						allowMissingRepository,
					})
				)
		);

	program
		.command('publish [version]')
		.description('Publishes an extension')
		.option(
			'-p, --pat <token>',
			'Personal Access Token (defaults to VSCE_PAT environment variable)',
			process.env['VSCE_PAT']
		)
		.option('-t, --target <targets...>', `Target architectures. Valid targets: ${ValidTargets}`)
		.option('-m, --message <commit message>', 'Commit message used when calling `npm version`.')
		.option(
			'--no-git-tag-version',
			'Do not create a version commit and tag when calling `npm version`. Valid only when [version] is provided.'
		)
		.option('--no-update-package-json', 'Do not update `package.json`. Valid only when [version] is provided.')
		.option('-i, --packagePath <paths...>', 'Publish the provided VSIX packages.')
		.option(
			'--githubBranch <branch>',
			'The GitHub branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option(
			'--gitlabBranch <branch>',
			'The GitLab branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option('--baseContentUrl <url>', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl <url>', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presence of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from lack of yarn.lock or .yarnrc)')
		.option('--noVerify')
		.option('--ignoreFile <path>', 'Indicate alternative .vscodeignore')
		// default must remain undefined for dependencies or we will fail to load defaults from package.json
		.option('--dependencies', 'Enable dependency detection via npm or yarn', undefined)
		.option('--no-dependencies', 'Disable dependency detection via npm or yarn', undefined)
		.option('--pre-release', 'Mark this package as a pre-release')
		.option('--allow-star-activation', 'Allow using * in activation events')
		.option('--allow-missing-repository', 'Allow missing a repository URL in package.json')
		.option('--skip-duplicate', 'Fail silently if version already exists on the marketplace')
		.action(
			(
				version,
				{
					pat,
					target,
					message,
					gitTagVersion,
					updatePackageJson,
					packagePath,
					githubBranch,
					gitlabBranch,
					baseContentUrl,
					baseImagesUrl,
					yarn,
					noVerify,
					ignoreFile,
					dependencies,
					preRelease,
					allowStarActivation,
					allowMissingRepository,
					skipDuplicate,
				}
			) =>
				main(
					publish({
						pat,
						version,
						targets: target,
						commitMessage: message,
						gitTagVersion,
						updatePackageJson,
						packagePath,
						githubBranch,
						gitlabBranch,
						baseContentUrl,
						baseImagesUrl,
						useYarn: yarn,
						noVerify,
						ignoreFile,
						dependencies,
						preRelease,
						allowStarActivation,
						allowMissingRepository,
						skipDuplicate,
					})
				)
		);

	program
		.command('unpublish [extensionid]')
		.description('Unpublishes an extension. Example extension id: microsoft.csharp.')
		.option('-p, --pat <token>', 'Personal Access Token')
		.option('-f, --force', 'Forces Unpublished Extension')
		.action((id, { pat, force }) => main(unpublish({ id, pat, force })));

	program
		.command('ls-publishers')
		.description('List all known publishers')
		.action(() => main(listPublishers()));

	program
		.command('delete-publisher <publisher>')
		.description('Deletes a publisher')
		.action(publisher => main(deletePublisher(publisher)));

	program
		.command('login <publisher>')
		.description('Add a publisher to the known publishers list')
		.action(name => main(loginPublisher(name)));

	program
		.command('logout <publisher>')
		.description('Remove a publisher from the known publishers list')
		.action(name => main(logoutPublisher(name)));

	program
		.command('verify-pat [publisher]')
		.option(
			'-p, --pat <token>',
			'Personal Access Token (defaults to VSCE_PAT environment variable)',
			process.env['VSCE_PAT']
		)
		.description('Verify if the Personal Access Token has publish rights for the publisher.')
		.action((name, { pat }) => main(verifyPat(pat, name)));

	program
		.command('show <extensionid>')
		.option('--json', 'Output data in json format', false)
		.description('Show extension metadata')
		.action((extensionid, { json }) => main(show(extensionid, json)));

	program
		.command('search <text>')
		.option('--json', 'Output result in json format', false)
		.option('--stats', 'Shows the extension rating and download counts', false)
		.option('-p, --pagesize [value]', 'Number of results to return', '100')
		.description('search extension gallery')
		.action((text, { json, pagesize, stats }) => main(search(text, json, parseInt(pagesize), stats)));

	program.on('command:*', ([cmd]: string) => {
		if (cmd === 'create-publisher') {
			log.error(
				`The 'create-publisher' command is no longer available. You can create a publisher directly in the Marketplace: https://aka.ms/vscode-create-publisher`
			);

			process.exit(1);
		}

		program.outputHelp(help => {
			const availableCommands = program.commands.map(c => c._name);
			const suggestion = availableCommands.find(c => leven(c, cmd) < c.length * 0.4);

			help = `${help}
Unknown command '${cmd}'`;

			return suggestion ? `${help}, did you mean '${suggestion}'?\n` : `${help}.\n`;
		});
		process.exit(1);
	});

	program.parse(argv);
};
