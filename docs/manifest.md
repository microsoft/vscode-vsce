# About the Manifest

Every Visual Studio Code extension needs a manifest file `package.json` at
the root of the extension directory structure.
Make sure it has at least the following fields:

* `name`
* `version`
* `publisher`
* `engines["vscode"]`

For example:

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