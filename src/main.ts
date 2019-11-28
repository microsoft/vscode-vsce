import * as program from 'commander';
import * as didYouMean from 'didyoumean';

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
			.then(version => latestVersion = version)
			.catch(_ => { /* noop */ });
	}

	task
		.catch(fatal)
		.then(() => {
			if (latestVersion && semver.gt(latestVersion, pkg.version)) {
				log.info(`\nThe latest version of ${pkg.name} is ${latestVersion} and you have ${pkg.version}.\nUpdate it now: npm install -g ${pkg.name}`);
			} else {
				token.cancel();
			}
		});
}

module.exports = function (argv: string[]): void {
	program
		.version(pkg.version)
		.usage('<command> [options]');

	program
		.command('ls')
		.description('Lists all the files that will be published')
		.option('--yarn', 'Use yarn instead of npm')
		.option('--packagedDependencies <path>', 'Select packages that should be published only (includes dependencies)', (val, all) => all ? all.concat(val) : [val], undefined)
		.option('--ignoreFile [path]', 'Indicate alternative .vscodeignore')
		.action(({ yarn, packagedDependencies, ignoreFile }) => main(ls(undefined, yarn, packagedDependencies, ignoreFile)));

	program
		.command('package')
		.description('Packages an extension')
		.option('-o, --out [path]', 'Output .vsix extension file to [path] location')
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm')
		.option('--ignoreFile [path]', 'Indicate alternative .vscodeignore')
		.action(({ out, baseContentUrl, baseImagesUrl, yarn, ignoreFile }) => main(packageCommand({ packagePath: out, baseContentUrl, baseImagesUrl, useYarn: yarn, ignoreFile })));

	program
		.command('publish [<version>]')
		.description('Publishes an extension')
		.option('-p, --pat <token>', 'Personal Access Token')
		.option('-m, --message <commit message>', 'Commit message used when calling `npm version`.')
		.option('--packagePath [path]', 'Publish the VSIX package located at the specified path.')
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm while packing extension files')
		.option('--noVerify')
		.option('--ignoreFile [path]', 'Indicate alternative .vscodeignore')
		.action((version, { pat, message, packagePath, baseContentUrl, baseImagesUrl, yarn, noVerify, ignoreFile }) => main(publish({ pat, commitMessage: message, version, packagePath, baseContentUrl, baseImagesUrl, useYarn: yarn, noVerify, ignoreFile })));

	program
		.command('unpublish [<extensionid>]')
		.description('Unpublishes an extension. Example extension id: microsoft.csharp.')
		.option('-p, --pat <token>', 'Personal Access Token')
		.action((id, { pat }) => main(unpublish({ id, pat })));

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

	program
		.command('*', '', { noHelp: true })
		.action((cmd: string) => {
			program.help(help => {
				const suggestion = didYouMean(cmd, program.commands.map(c => c._name));

				help = `${help}
Unknown command '${cmd}'`;

				return suggestion ? `${help}, did you mean '${suggestion}'?\n` : `${help}.\n`;
			});
		});

	program.parse(argv);

	if (process.argv.length <= 2) {
		program.help();
	}
};
