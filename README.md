# vsce

> _The Visual Studio Code Extension Manager_

[![ci](https://github.com/microsoft/vsce/workflows/ci/badge.svg)](https://github.com/microsoft/vsce/actions?query=workflow%3Aci)
[![Version](https://img.shields.io/npm/v/vsce.svg)](https://npmjs.org/package/vsce)

## Requirements

- [Node.js](https://nodejs.org/en/) at least `10.x.x`

Or simply [Docker](#via-docker).

### Linux

This project uses [keytar](https://www.npmjs.com/package/keytar) that uses `libsecret`, so you may need to install it before running `vsce`.

Depending on your distribution, you will need to run the following command:

- Debian/Ubuntu: `sudo apt-get install libsecret-1-dev`
- Alpine: `apk add libsecret`
- Red Hat-based: `sudo yum install libsecret-devel`
- Arch Linux: `sudo pacman -S libsecret`

## Usage

Install vsce globally:

```sh
npm install -g vsce
```

Verify the installation:

```sh
vsce --version
```

`vsce` is meant to be mainly used as a command line tool. It can also be used a library since it exposes a small [API](https://github.com/microsoft/vscode-vsce/blob/main/src/api.ts). When using vsce as a library be sure to sanitize any user input used in API calls, as a security measurement.

## Usage via Docker

You can also build a container for running vsce:

```sh
git clone https://github.com/microsoft/vscode-vsce
cd vscode-vsce
docker build -t vsce .
```

Validate the container:

```sh
docker run -it vsce --version
```

Publish your local extension:

```sh
docker run -it -v $(pwd):/workspace vsce publish
```

## Development

First clone this repository, then:

```sh
npm i
npm run watch:build # or `watch:test` to also build tests
```

Once the watcher is up and running, you can run out of sources with:

```sh
node vsce
```

This project uses [semantic-release](https://semantic-release.gitbook.io/semantic-release/) and commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) spec. This allows us to effortlessly automate releases.

## About

This tool assists in packaging and publishing Visual Studio Code extensions.

Read the [**Documentation**](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code website.
