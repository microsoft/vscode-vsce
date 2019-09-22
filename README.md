# vsce

> *The Visual Studio Code Extension Manager*

[![Build Status](https://dev.azure.com/vscode/VSCE/_apis/build/status/VSCE?branchName=master)](https://dev.azure.com/vscode/VSCE/_build/latest?definitionId=16&branchName=master) [![npm version](https://badge.fury.io/js/vsce.svg)](https://badge.fury.io/js/vsce)

## Requirements

- [Node.js](https://nodejs.org/en/) at least `8.x.x`

## Development

First clone this repository, then:

```sh
yarn
yarn watch # or `watch-test` to also run tests
```

Once the watcher is up and running, you can run out of sources with:

```sh
yarn vsce
```

### Publish to NPM

Simply push a new tag and the CI will automatically publish to NPM. The usual flow is:

```sh
npm version [minor|patch]
git push --follow-tags
```

## About

This tool assists in packaging and publishing Visual Studio Code extensions.

Read the [**Documentation**](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code website.
