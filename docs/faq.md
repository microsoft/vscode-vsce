# FAQ

### Can my extension depend on node modules?

Sure, just add the `dependencies` list to the `package.json` and run `npm install`
before publishing.

### What about native node modules?

No. Well...

Visual Studio Code extensions' packages contain their full dependencies. This means
that if you develop your extension on Windows, depend on a native node module and
publish that extension, the Windows compiled native dependency will be contained
in your extension. Users on OS X or Linux won't be able to use it.

The only way to make this work for now is to include binaries for all 4 platforms
of Visual Studio Code in your extensions and have code that dynamically loads the
right one.

### What should be included in an extension package?

You need to make sure that every thing needed to run your extension will end up
in your extension package. You can run `vsce ls` to list all the files that
`vsce` will include in the package.

If, for example, your extension depends on node modules, you **must not exclude**
the `node_modules` directory from the packaging step.

You should ignore all files not needed at runtime. For example, if your extension
is written in TypeScript, you should ignore all `**/*.ts` files. You can use the
[`.vsceignore`](https://github.com/Microsoft/vsce/blob/master/docs/advanced.md#vsceignore)
file for this.
