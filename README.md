# VSCode Extension Manager

This tool assists in publishing Visual Studio Code extensions.

## Get Started

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

## Help Topics

* [Manifest File](docs/manifest.md)
* [Publishers and Personal Access Tokens](docs/publishers.md)
* [Advanced Usage](docs/advanced.md)
* [FAQ](docs/faq.md)
