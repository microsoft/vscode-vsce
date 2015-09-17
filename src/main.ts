import * as minimist from 'minimist';
import _package = require('./package');
const packagejson = require('../package.json');

interface ICommand {
	(args: minimist.ParsedArgs): boolean;
}

function helpCommand(args: minimist.ParsedArgs): boolean {
	console.log(`Usage: vsce [command] [opts] [args]

Commands:
    package [path]          Packages the extension into a .vsix package

Global options:
    --help, -h              Display help

VSCode Extension Manager v${ packagejson.version }`
	);
	
	process.exit(0);
	return true;
}

function packageCommand(args: minimist.ParsedArgs): boolean {
	_package(args._[1]);
	return true;
}

function command(name: string): ICommand {
	switch (name) {
		case 'package': return packageCommand;
		default: return helpCommand;
	}
}

module.exports = function (argv: string[]): void {
	var args = minimist(argv);
	
	if (args['help'] || args['h'] || args._.length === 0) {
		helpCommand(args);
		return;
	}
	
	if (!command(args._[0])(args)) {
		helpCommand(args);
		return;
	}
};
