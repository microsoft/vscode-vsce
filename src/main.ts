import * as program from 'commander';
import { packageCommand, ls } from './package';
import { publish, list, unpublish } from './publish';
import { show } from './show';
import { listPublishers, createPublisher, deletePublisher, loginPublisher, logoutPublisher } from './store';
import { getLatestVersion } from './npm';
import { CancellationToken, isCancelledError } from './util';
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

	console.error('Error:', message, ...args);

	if (/Unauthorized\(401\)/.test(message)) {
		console.error(`Be sure to use a Personal Access Token which has access to **all accessible accounts**.
See https://code.visualstudio.com/docs/tools/vscecli#_common-questions for more information.`);
	}

	process.exit(1);
}

function main<T>(task: Promise<any>): void {
	let latestVersion: string = null;

	const token = new CancellationToken();

	if (isatty(1)) {
		getLatestVersion(pkg.name, token)
			.then(version => latestVersion = version)
			.catch(err => !isCancelledError(err) && console.error(err));
	}

	task
		.catch(fatal)
		.then(() => {
			if (latestVersion && semver.gt(latestVersion, pkg.version)) {
				console.log(`\nThe latest version of ${pkg.name} is ${latestVersion} and you have ${pkg.version}.\nUpdate it now: npm install -g ${pkg.name}`);
			} else {
				token.cancel();
			}
		});
}

module.exports = function (argv: string[]): void {
	program
		.version(pkg.version);

	program
		.command('ls')
		.description('Lists all the files that will be published')
		.option('--yarn', 'Use yarn instead of npm')
		.action(({ yarn }) => main(ls(undefined, yarn)));

	program
		.command('package')
		.description('Packages an extension')
		.option('-o, --out [path]', 'Location of the package')
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.action(({ out, baseContentUrl, baseImagesUrl }) => main(packageCommand({ packagePath: out, baseContentUrl, baseImagesUrl })));

	program
		.command('publish [<version>]')
		.description('Publishes an extension')
		.option('-p, --pat <token>', 'Personal Access Token')
		.option('--packagePath [path]', 'Publish the VSIX package located at the specified path.')
		.option('--baseContentUrl [url]', 'Prepend all relative links in README.md with this url.')
		.option('--baseImagesUrl [url]', 'Prepend all relative image links in README.md with this url.')
		.action((version, { pat, packagePath, baseContentUrl, baseImagesUrl }) => main(publish({ pat, version, packagePath, baseContentUrl, baseImagesUrl })));

	program
		.command('unpublish [<extensionid>]')
		.description('Unpublishes an extension. Example extension id: microsoft.csharp.')
		.option('-p, --pat <token>', 'Personal Access Token')
		.action((id, { pat }) => main(unpublish({ id, pat })));

	program
		.command('list <publisher>')
		.description('Lists all extensions published by the given publisher')
		.action(publisher => main(list(publisher)));

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
		.command('*')
		.action(() => program.help());

	program.parse(argv);

	if (process.argv.length <= 2) {
		program.help();
	}
};
