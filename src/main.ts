import * as program from 'commander';
import { packageCommand, ls } from './package';
import { publish, list, unpublish } from './publish';
import { catchFatal } from './util';
import { listPublishers, createPublisher, deletePublisher, loginPublisher, logoutPublisher } from './store';
const packagejson = require('../package.json');

module.exports = function (argv: string[]): void {
	program
		.version(packagejson.version);

	program
		.command('ls')
		.description('Lists all the files that will be published')
		.action(() => catchFatal(ls()));

	program
		.command('package')
		.description('Packages an extension')
		.option('-o, --out [path]', 'Location of the package')
		.option('--baseContentUrl [url]', 'If found, all relative links in README.md will be prepended with this url.')
		.option('--baseImagesUrl [url]', 'If found, all relative image links in README.md will be prepended with this url.')
		.action(({ out, baseContentUrl, baseImagesUrl }) => catchFatal(packageCommand({ packagePath: out, baseContentUrl, baseImagesUrl })));

	program
		.command('publish')
		.description('Publishes an extension')
		.action(() => catchFatal(publish()));

	program
		.command('unpublish [publisher] [name]')
		.description('Unpublishes an extension')
		.action((publisher, name) => catchFatal(unpublish(publisher, name)));

	program
		.command('list <publisher>')
		.description('Lists all extensions published by the given publisher')
		.action(publisher => catchFatal(list(publisher)));

	program
		.command('ls-publishers')
		.description('List all known publishers')
		.action(() => catchFatal(listPublishers()));

	program
		.command('create-publisher <publisher>')
		.description('Creates a new publisher')
		.action(publisher => catchFatal(createPublisher(publisher)));

	program
		.command('delete-publisher <publisher>')
		.description('Deletes a publisher')
		.action(publisher => catchFatal(deletePublisher(publisher)));

	program
		.command('login <publisher>')
		.description('Add a publisher to the known publishers list')
		.action(name => catchFatal(loginPublisher(name)));

	program
		.command('logout <publisher>')
		.description('Remove a publisher from the known publishers list')
		.action(name => catchFatal(logoutPublisher(name)));

	program.parse(argv);

	if (process.argv.length <= 2) {
		program.help();
	}
};
