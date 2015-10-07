# VSCode Extension Manager

This tool assists in publishing Visual Studio Code extensions.

```
npm install -g vsce
```

**Note:** Before you can publish an extension to the gallery, you'll first need
to [create a publisher](docs/pat.md).

## Manifest files

Every Visual Studio Code extension needs a manifest file: `package.json`.
Make sure it has at least the following fields:

* `name`
* `version`
* `publisher`
* `engines["vscode"]`

### Example:

```json
{
	"name": "uuid",
	"version": "0.0.1",
	"publisher": "joaomoreno",
	"engines": {
		"vscode": "*"
	}
}
```

## Publishing

Before publishing it is good practice to list the files that will be included
in your extension's package:

```
$ vsce ls
hello.js
package.json
```

If that looks good, you can now publish your extension:

```
$ vsce publish
Publishing uuid@0.0.1...
Successfully published uuid@0.0.1!
```

The extension should now appear in the gallery.

## Configuration

### `.vsceignore`

You can create a `.vsceignore` file to exclude some files from being included
in your extension's package. This file is a collection of
[glob](https://github.com/isaacs/minimatch) patterns, one per line.
For example:

```
**/*.ts
**/tsconfig.json
!file.ts
```

### Pre-publish step

It's possible to add a pre-publish step to your manifest file. The command
will be called everytime the extension is packaged.

```json
{
	"name": "uuid",
	"version": "0.0.1",
	"publisher": "joaomoreno",
	"engines": {
		"vscode": "*"
	},
	"scripts": {
		"vscode:prepublish": "tsc"
	}
}
```

This will always invoke the [TypeScript](http://www.typescriptlang.org/)
compiler whenever the extension is packaged.
