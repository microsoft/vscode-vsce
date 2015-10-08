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

The manifest file builds upon [npm's `package.json`](https://docs.npmjs.com/files/package.json).

Name | Required | Type | Details
---- |:--------:| ---- | -------
`name` | ✓ | `string` | The name of the extension.
`version` | ✓ | `string` | [Semver](http://semver.org/) compatible version.
`publisher` | ✓ | `string` | The [**publisher name**](https://github.com/Microsoft/vsce/blob/master/docs/publishers.md).
`engines` | ✓ | `object` | An object containing at least the `vscode` key matching the versions of Code that the extension is compatible with.
`contributes` | | `object` | An object describing the extension's contributions.
`activationEvents` | | `array` | An array of the activation events for this extension.
`keywords` | | `array` | An array of **keywords** or **tags** to make it easier to find the extension.

