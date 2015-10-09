# VSCode Extension Manager

This tool assists in publishing Visual Studio Code extensions. [Read the docs](https://github.com/Microsoft/vscode-extensionbuilders/blob/master/docs/tools/gallerycli.md).

## Usage

First, install using npm:

```
npm install -g vsce
```

Then, `cd` to your extension's directory.
It is good practice to list the files that will be included in your extension's
package, before you actually publish:

```
$ vsce ls
hello.js
package.json
```

Publish away:

```
$ vsce publish
Publishing uuid@0.0.1...
Successfully published uuid@0.0.1!
```
