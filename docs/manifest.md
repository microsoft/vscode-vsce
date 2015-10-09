# Manifest File

Every Visual Studio Code extension needs a manifest file `package.json` at
the root of the extension directory structure.

Here's a minimal manifest file:

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

## Fields

Name | Required | Type | Details
---- |:--------:| ---- | -------
`name` | ✓ | `string` | The name of the extension.
`version` | ✓ | `string` | [Semver](http://semver.org/) compatible version.
`publisher` | ✓ | `string` | The [publisher name](https://github.com/Microsoft/vsce/blob/master/docs/publishers.md).
`engines` | ✓ | `object` | An object containing at least the `vscode` key matching the versions of Code that the extension is compatible with.
`description` | | `string` | A short description of what your extension is and does.
`main` | | `string` | The entry point to your extension.
`contributes` | | `object` | An object describing the extension's contributions.
`activationEvents` | | `array` | An array of the activation events for this extension.
`keywords` | | `array` | An array of **keywords** or **tags** to make it easier to find the extension.
`dependencies` | | `object` | Any runtime Node.JS dependencies you extensions needs. Exactly the same as [npm's `dependencies`](https://docs.npmjs.com/files/package.json#dependencies).
`devDependencies` | | `object` | Any development Node.JS dependencies your extension needs. Exactly the same as [npm's `devDependencies`](https://docs.npmjs.com/files/package.json#devdependencies).
`extensionDependencies` | | `array` | An array with the ids of extensions that this extension depends on. The id of an extension is always `${ publisher }.${ name }`. For example: `vscode.csharp`.
`isAMD` | | `boolean` | Indicated whether Visual Studio Code should load your code as AMD or CommonJS. Default: `false`.
`scripts` | | `object` | Exactly the same as [npm's `scripts`](https://docs.npmjs.com/misc/scripts) but with [extra fields](https://github.com/Microsoft/vsce/blob/master/docs/advanced.md#pre-publish-step).

Also check [npm's `package.json` reference](https://docs.npmjs.com/files/package.json).
