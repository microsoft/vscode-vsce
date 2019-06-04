import * as program from 'commander';
const didYouMean = require('didyoumean');

import { packageCommand, ls } from './package';
import { publish, unpublish } from './publish';
import { show } from './show';
import { search } from './search';
import { listPublishers, createPublisher, deletePublisher, loginPublisher, logoutPublisher } from './store';
import { getLatestVersion } from './npm';
import { CancellationToken, isCancelledError, log } from './util';
import * as semver from 'semver';
import { isatty } from 'tty';
const pkg = require('../package.json');

function fatal<T>(message: any, ...args: any[]): void {
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
			.catch(err => !isCancelledError(err) && log.error(err));
	}

	task
		.catch(fatal)
		.then(() => {
			if (latestVersion && semver.gt(latestVersion, pkg.version)) {
				log.warn(`\nThe latest version of ${pkg.name} is ${latestVersion} and you have ${pkg.version}.\nUpdate it now: npm install -g ${pkg.name}`);
			} else {
				token.cancel();
			}
		});
}

function suggestCommands(cmd: string): void {
	const availableCommands = program.commands.map(c => c._name);
	
	  const suggestion: string | string[] = didYouMean(cmd, availableCommands);
	  if (suggestion) {
		log.warn(`Did you mean '${suggestion}'?`);
	  }
}

module.exports = function (argv: string[]): void {
	program
		.version(pkg.version);

	program
		.command('ls')
		.description('Lists all the files that will be published')
		.option('--yarn', 'Use yarn instead of npm')
		.option('--packagedDependencies <path>', 'Select packages that should be published only (includes dependencies)', (val, all) => all ? all.concat(val) : [val], undefined)
		.action(({ yarn, packagedDependencies }) => main(ls(undefined, yarn, packagedDependencies)));

	program
		.command('package')
		.description('Packages an extension')
		.option('-o, --out [path]', 'Output .vsix extension file to [path] location')
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm')
		.action(({ out, baseContentUrl, baseImagesUrl, yarn }) => main(packageCommand({ packagePath: out, baseContentUrl, baseImagesUrl, useYarn: yarn })));

	program
		.command('publish [<version>]')
		.description('Publishes an extension')
		.option('-p, --pat <token>', 'Personal Access Token')
		.option('--packagePath [path]', 'Publish the VSIX package located at the specified path.')
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.option('--yarn', 'Use yarn instead of npm while packing extension files')
		.option('--noVerify')
		.action((version, { pat, packagePath, baseContentUrl, baseImagesUrl, yarn, noVerify }) => main(publish({ pat, version, packagePath, baseContentUrl, baseImagesUrl, useYarn: yarn, noVerify })));

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
		.command('*')
		.action((cmd: string) => {
			program.outputHelp();
			log.error(`Unknown command ${cmd}`);
			suggestCommands(cmd);
		});

	program.parse(argv);

	if (process.argv.length <= 2) {
		program.help();
	}
};
