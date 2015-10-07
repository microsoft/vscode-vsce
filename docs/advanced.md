# Advanced Usage

## `.vsceignore`

You can create a `.vsceignore` file to exclude some files from being included
in your extension's package. This file is a collection of
[glob](https://github.com/isaacs/minimatch) patterns, one per line.
For example:

```
**/*.ts
**/tsconfig.json
!file.ts
```

## Pre-publish step

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
