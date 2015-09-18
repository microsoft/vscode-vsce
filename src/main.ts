import * as minimist from 'minimist';
import { pack } from './package';
import { publish } from './publish';
import { fatal } from './util';
import { login, logout } from './login';
const packagejson = require('../package.json');

interface ICommand {
	(args: minimist.ParsedArgs): boolean;
}

function helpCommand(args: minimist.ParsedArgs): boolean {
	console.log(`Usage: vsce [command] [opts] [args]

Commands:
    package [vsix path]          Packages the extension into a .vsix package
    publish                      Publishes the extension
    login                        Logs in to the extension service
    logout                       Logs out of the extension service

Global options:
    --help, -h                   Display help

VSCode Extension Manager v${ packagejson.version }`
	);
	
	process.exit(0);
	return true;
}

function command(args: minimist.ParsedArgs): boolean {
	const promise = (() => {
		switch (args._[0]) {
			case 'package': return pack(args._[1]);
			case 'login': return login();
			case 'logout': return logout();
			case 'publish': return publish(args._[1]);
			default: return null;
		}
	})();
	
	if (promise) {
		promise.catch(fatal);
		return true;
	}
	
	return false;
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
