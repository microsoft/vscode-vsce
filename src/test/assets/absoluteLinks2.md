# README

>**Important:** Once installed the checker will only update if you add the setting `"spellMD.enable": true` to your `.vscode\settings.json` file.

This README covers off:
* [Functionality](#functionality)
* [Install](#install)
* [Run and Configure](#run-and-configure)
* [Known Issues/Bugs](#known-issuesbugs)
* [Backlog](#backlog)
* [How to Debug](#how-to-debug)

# Functionality

Load up a Markdown file and get highlights and hovers for existing issues.  Checking will occur as you type in the document.

![Underscores and hovers](https://github.com/Microsoft/vscode-SpellMD/raw/master/images/SpellMDDemo1.gif)

The status bar lets you quickly navigate to any issue and you can see all positions in the gutter.

![Jump to issues](https://github.com/Microsoft/vscode-SpellMD/raw/master/images/SpellMDDemo2.gif)

The `spellMD.json` config file is watched so you can add more ignores or change mappings at will.

![Add to dictionary](https://github.com/Microsoft/vscode-SpellMD/raw/master/images/SpellMDDemo3.gif)

# Install
This extension is published in the VS Code Gallery.  So simply hit 'F1' and type 'ext inst' from there select `SpellMD` and follow instructions.


To clone the extension and load locally...

```
git clone https://github.com/Microsoft/vscode-SpellMD.git
npm install
tsc
```

>**Note:** TypeScript 1.6 or higher is required you can check with `tsc -v` and if you need to upgrade then run `npm install -g typescript`.

Copy the extension folder into user settings.

Depending on your platform, this folder is located here:
* **Windows** `%USERPROFILE%\.vscode\extensions`
* **Mac** `$HOME/.vscode/extensions`
* **Linux** `$HOME/.vscode/extensions`

# Run and Configure

## Enable via Config setting
Add the following setting to your WorkSpace [or User] settings:

```json
	"spellMD.enable": true,
```

## Open a Markdown file
Then open any Markdown file and BOOM.

## Configure
The plug-in supports and watches a config file.  This should go in the `.vscode` directory and needs to be called `spellMD.json`.  This file has the following sections:
* **version** incase I change the format
* **ignoreWordsList** an array of strings that represents words not to check
* **mistakeTypeToStatus** we detect many error types and this is how they map to VS Code severities
* **replaceRegExp** this is an arry of RegExps represented as strings for pre-parsing the doc e.g. removing code blocks

> **Tip:** you need to convert any `\` from the RegExp to a `\\\\` sequence for the JSON to parse.

Here is an example file...

```json
{
	"version": "0.1.0",
	"ignoreWordsList": [
		"IntelliSense", "project.json", "nodejs", "transpiled",	"ASPNET"
	],
	"mistakeTypeToStatus": {
		"Passive voice": "Info",
		"Spelling": "Error",
		"Complex Expression": "Info",
		"Hidden Verbs": "Info",
		"Hyphen Required": "Error",
		"Did you mean...": "Info",
		"Repeated Word": "Error",
		"Missing apostrophe": "Error",
		"Redundant Expression": "Info",
		"Cliches": "Warn",
		"Missing Word": "Warn",
		"Make I uppercase": "Error"
	},
	"replaceRegExp": [
		"/^((`{3}\\\\s*)(\\\\w+)?(\\\\s*([\\\\w\\\\W]+?)\\\\n*)\\\\2)\\\\n*(?:[^\\\\S\\\\w\\\\s]|$)/gm",
		"/\\\\]\\\\(([^\\\\)]+)\\\\)/g"
	]
}
```

# Backlog

Here are some ideas - fell free to add more.

1. Let the user act on the suggestions e.g. a right-click or `Alt+S` opens command palette with suggestions, selection replaces.
2. Include the Text Tools extension w/ this i.e. WordCount, HTMLEncode etc
3. On project open check every file in the background
	1. Have an `excludeFilesList` in the options
	2. Suppress some types of issue completely i.e. don't report `Cliches` less noise in the list
4. Provide an action to add a word to the dictionary e.g. `Alt+A`
	1. Automatically create a spellMD.json file when a user adds a word
	2. When adding a word also add plurals/sentence case etc


# Debug This Code
Run this command in the directory w/ markdown files to check.

```
code  --debugLanguageWorker=* --extensionDevelopmentPath="c:\src\vscode-SpellMD" .
```

Then open `VS Code` in the project directory and `Attach` to the running process.