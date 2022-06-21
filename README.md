# vsce

> _The Visual Studio Code Extension Manager_

[![ci](https://github.com/microsoft/vsce/workflows/ci/badge.svg)](https://github.com/microsoft/vsce/actions?query=workflow%3Aci)
[![Version](https://img.shields.io/npm/v/vsce.svg)](https://npmjs.org/package/vsce)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

## Requirements

- [Node.js](https://nodejs.org/en/) at least `14.x.x`

Or simply [Docker](#usage-via-docker).

### Linux

In order to save credentials safely, this project uses [keytar](https://www.npmjs.com/package/keytar) which uses `libsecret`, which you may need to install before publishing extensions. Setting the `VSCE_STORE=file` environment variable will revert back to the file credential store. Using the `VSCE_PAT` environment variable will also avoid using keytar.

Depending on your distribution, you will need to run the following command:

- Debian/Ubuntu: `sudo apt-get install libsecret-1-dev`
- Alpine: `apk add libsecret`
- Red Hat-based: `sudo yum install libsecret-devel`
- Arch Linux: `sudo pacman -S libsecret`

## Usage

Install vsce globally:

```console
npm install --global vsce
```

Verify the installation:

```console
vsce --version
```

`vsce` is meant to be mainly used as a command line tool. It can also be used a library since it exposes a small [API](https://github.com/microsoft/vscode-vsce/blob/main/src/api.ts). When using vsce as a library be sure to sanitize any user input used in API calls, as a security measurement.

## Usage via Docker

You can also build a container for running vsce:

```console
$ DOCKER_BUILDKIT=1 docker build --tag vsce "https://github.com/microsoft/vscode-vsce.git#main"
```

Validate the container:

```console
docker run --rm -it vsce --version
```

Publish your local extension:

```console
docker run --rm -it -v "$(pwd)":/workspace vsce publish
```

## Configuration

You can configure the behavior of `vsce` by using CLI flags (run `vsce --help` to list them all). Example:

```console
vsce publish --baseImagesUrl https://my.custom/base/images/url
```

Or you can also set them in the `package.json`, so that you avoid having to retype the common options again. Example:

```jsonc
// package.json
{
  "vsce": {
    "baseImagesUrl": "https://my.custom/base/images/url"
    "dependencies": true,
    "yarn": false
  }
}
```

## Development

First clone this repository, then:

```console
$ npm install

$ npm run watch:build # or `watch:test` to also build tests
```

Once the watcher is up and running, you can run out of sources with:

```console
node vsce
```

This project uses [semantic-release](https://semantic-release.gitbook.io/semantic-release/) and commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) spec. This allows us to effortlessly automate releases.

## About

This tool assists in packaging and publishing Visual Studio Code extensions.

Read the [**Documentation**](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code website.
