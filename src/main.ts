import * as minimist from 'minimist';
import { pack } from './package';
import { publish } from './publish';
import { fatal } from './util';
const packagejson = require('../package.json');

interface ICommand {
	(args: minimist.ParsedArgs): boolean;
}

function helpCommand(args: minimist.ParsedArgs): boolean {
	console.log(`Usage: vsce [command] [opts] [args]

Commands:
    package [vsix path]          Packages the extension into a .vsix package
    publish [pat]                Publishes the extension

Global options:
    --help, -h                   Display help

VSCode Extension Manager v${ packagejson.version }`
	);
	
	process.exit(0);
	return true;
}

function command(args: minimist.ParsedArgs): boolean {
	switch (args._[0]) {
		case 'package':
			pack(args._[1]).then(({ packagePath }) => console.log(`Package created: ${ packagePath }`), fatal);
			return true;
		case 'publish':
			publish(args._[1]).catch(fatal);
			return true;
		default:
			return false;
	}
}

module.exports = function (argv: string[]): void {
	var args = minimist(argv);
	
	if (args['help'] || args['h'] || args._.length === 0) {
		helpCommand(args);
		return;
	}
	
	if (!command(args)) {
		helpCommand(args);
		return;
	}
};
