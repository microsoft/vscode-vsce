import * as program from 'commander';
import * as leven from 'leven';

import { packageCommand, ls } from './package';
import { publish, unpublish } from './publish';
import { show } from './show';
import { search } from './search';
import { listPublishers, createPublisher, deletePublisher, loginPublisher, logoutPublisher } from './store';
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
	let latestVersion: string = null;

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

module.exports = function (argv: string[]): void {
	program.version(pkg.version).usage('<command> [options]');

	program
		.command('ls')
		.description('Lists all the files that will be published')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presense of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from lack of yarn.lock or .yarnrc)')
		.option(
			'--packagedDependencies <path>',
			'Select packages that should be published only (includes dependencies)',
			(val, all) => (all ? all.concat(val) : [val]),
			undefined
		)
		.option('--ignoreFile [path]', 'Indicate alternative .vscodeignore')
		.action(({ yarn, packagedDependencies, ignoreFile }) =>
			main(ls(undefined, yarn, packagedDependencies, ignoreFile))
		);

	program
		.command('package')
		.description('Packages an extension')
		.option('-o, --out [path]', 'Output .vsix extension file to [path] location')
		.option(
			'--githubBranch [branch]',
			'The GitHub branch used to infer relative links in README.md. Can be overriden by --baseContentUrl and --baseImagesUrl.'
		)
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presense of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from lack of yarn.lock or .yarnrc)')
		.option('--ignoreFile [path]', 'Indicate alternative .vscodeignore')
		.option('--noGitHubIssueLinking', 'Prevent automatic expansion of GitHub-style issue syntax into links')
		.option(
			'--web',
			'Experimental flag to enable publishing web extensions. Note: This is supported only for selected extensions.'
		)
		.action(({ out, githubBranch, baseContentUrl, baseImagesUrl, yarn, ignoreFile, noGitHubIssueLinking, web }) =>
			main(
				packageCommand({
					packagePath: out,
					githubBranch,
					baseContentUrl,
					baseImagesUrl,
					useYarn: yarn,
					ignoreFile,
					expandGitHubIssueLinks: noGitHubIssueLinking,
					web,
				})
			)
		);

	program
		.command('publish [<version>]')
		.description('Publishes an extension')
		.option('-p, --pat <token>', 'Personal Access Token', process.env['VSCE_PAT'])
		.option('-m, --message <commit message>', 'Commit message used when calling `npm version`.')
		.option('--packagePath [path]', 'Publish the VSIX package located at the specified path.')
		.option(
			'--githubBranch [branch]',
			'The GitHub branch used to infer relative links in README.md. Can be overriden by --baseContentUrl and --baseImagesUrl.'
		)
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presense of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from lack of yarn.lock or .yarnrc)')
		.option('--noVerify')
		.option('--ignoreFile [path]', 'Indicate alternative .vscodeignore')
		.option(
			'--web',
			'Experimental flag to enable publishing web extensions. Note: This is supported only for selected extensions.'
		)
		.action(
			(
				version,
				{ pat, message, packagePath, githubBranch, baseContentUrl, baseImagesUrl, yarn, noVerify, ignoreFile, web }
			) =>
				main(
					publish({
						pat,
						commitMessage: message,
						version,
						packagePath,
						githubBranch,
						baseContentUrl,
						baseImagesUrl,
						useYarn: yarn,
						noVerify,
						ignoreFile,
						web,
					})
				)
		);

	program
		.command('unpublish [<extensionid>]')
		.description('Unpublishes an extension. Example extension id: microsoft.csharp.')
		.option('-p, --pat <token>', 'Personal Access Token')
		.option('-f, --force', 'Forces Unpublished Extension')
		.action((id, { pat, force }) => main(unpublish({ id, pat, force })));

	program
		.command('ls-publishers')
		.description('List all known publishers')
		.action(() => main(listPublishers()));

	program
		.command('create-publisher <publisher>')
		.description('Creates a new publisher')
		.action(publisher => main(createPublisher(publisher)));

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
		.command('show <extensionid>')
		.option('--json', 'Output data in json format', false)
		.description('Show extension metadata')
		.action((extensionid, { json }) => main(show(extensionid, json)));

	program
		.command('search <text>')
		.option('--json', 'Output result in json format', false)
		.description('search extension gallery')
		.action((text, { json }) => main(search(text, json)));

	program.on('command:*', (cmd: string) => {
		program.help(help => {
			const availableCommands = program.commands.map(c => c._name);
			const suggestion = availableCommands.find(c => leven(c, cmd[0]) < c.length * 0.4);

			help = `${help}
Unknown command '${cmd[0]}'`;

			return suggestion ? `${help}, did you mean '${suggestion}'?\n` : `${help}.\n`;
		});
	});

	program.parse(argv);
};
