import * as program from 'commander';
import { pack, ls } from './package';
import { publish, list, unpublish } from './publish';
import { fatal } from './util';
import { listPublishers, createPublisher, deletePublisher, loginPublisher, logoutPublisher } from './store';
const packagejson = require('../package.json');

module.exports = function (argv: string[]): void {
	program
		.version(packagejson.version);
	
	program
		.command('ls')
		.description('Lists all the files that will be published')
		.action(() => ls());
	
	program
		.command('publish')
		.description('Publishes an extension')
		.action(() => publish());
	
	program
		.command('unpublish [publisher] [name]')
		.description('Unpublishes an extension')
		.action((publisher, name) => unpublish(publisher, name));
	
	program
		.command('list <publisher>')
		.description('Lists all extensions published by the given publisher')
		.action(publisher => list(publisher));
	
	program
		.command('ls-publishers')
		.description('List all known publishers')
		.action(() => listPublishers());
	
	program
		.command('create-publisher <publisher>')
		.description('Creates a new publisher')
		.action(publisher => createPublisher(publisher));
	
	program
		.command('delete-publisher <publisher>')
		.description('Deletes a publisher')
		.action(publisher => deletePublisher(publisher));
	
	program
		.command('login <publisher>')
		.description('Add a publisher to the known publishers list')
		.action(name => loginPublisher(name));
	
	program
		.command('logout <publisher>')
		.description('Remove a publisher from the known publishers list')
		.action(name => logoutPublisher(name));
	
	program.parse(argv);
		
	if (process.argv.length <= 2) {
		program.help();
	}
};
