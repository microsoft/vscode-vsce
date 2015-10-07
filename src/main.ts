import * as minimist from 'minimist';
import { pack, ls } from './package';
import { publish, list, unpublish } from './publish';
import { fatal } from './util';
import { publisher } from './store';
const packagejson = require('../package.json');

function helpCommand(): void {
	console.log(`Usage: vsce [opts] <command> [args]

Commands:
    ls                              Lists all the files that will be published
    publish                         Publishes an extension
    unpublish [<publisher> <name>]  Unpublishes an extension
    list <publisher>                Lists all extensions published by the given publisher
    publisher                       List all known publishers
    publisher create <publisher>    Creates a new publisher
    publisher delete <publisher>    Deletes a publisher
    publisher login <publisher>     Add a publisher to the known publishers list
    publisher logout <publisher>    Remove a publisher from the known publishers list

Global options:
    --help, -h                      Display help
    --version, -v                   Display version

VSCode Extension Manager v${ packagejson.version }`
	);
}

function versionCommand(): void {
	console.log(packagejson.version);
}

function command(args: minimist.ParsedArgs): boolean {
	try {
		const promise = (() => {
			switch (args._[0]) {
				case 'package': return pack(args._[1]).then(({ packagePath }) => console.log(`Package created: ${ packagePath }`));
				case 'ls': return ls();
				case 'publish': return publish(args._[1]);
				case 'unpublish': return unpublish(args._[1], args._[2]);
				case 'list': return list(args._[1]);
				case 'publisher': return publisher(args._[1], args._[2]);
				default: return null;
			}
		})();
		
		if (promise) {
			promise.catch(fatal);
			return true;
		}
		
		return false;
	} catch (e) {
		fatal(e);
		return true;
	}
}

module.exports = function (argv: string[]): void {
	var args = minimist(argv);
	
	if (args['version'] || args['v']) {
		versionCommand();
	} else if (args['help'] || args['h'] || args._.length === 0) {
		helpCommand();
	} else if (!command(args)) {
		helpCommand();
	}
};
