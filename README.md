# @vscode/vsce

> _The Visual Studio Code Extension Manager_

[![Build Status](https://dev.azure.com/monacotools/Monaco/_apis/build/status/npm/microsoft.vscode-vsce?repoName=microsoft%2Fvscode-vsce&branchName=main)](https://dev.azure.com/monacotools/Monaco/_build/latest?definitionId=446&repoName=microsoft%2Fvscode-vsce&branchName=main)
[![Version](https://img.shields.io/npm/v/@vscode/vsce.svg)](https://npmjs.org/package/@vscode/vsce)

This tool assists in packaging and publishing Visual Studio Code extensions.

Read the [**Documentation**](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code website.

## Requirements

[Node.js](https://nodejs.org/en/) at least `22.x.x`.

### Linux

In order to save credentials safely, this project uses [`@napi-rs/keyring`](https://www.npmjs.com/package/@napi-rs/keyring), which uses the system Secret Service and falls back to the Linux kernel keyring. Setting the `VSCE_STORE=file` environment variable will revert back to the file credential store. Using the `VSCE_PAT` environment variable will also avoid using the system credential store.

### Upgrading saved PATs

When a command needs a saved Personal Access Token and the publisher has none in the current native credential store, `vsce` checks for that publisher's old `keytar` credential. If one is found in an interactive terminal, it offers:

```text
A saved PAT for publisher 'your-publisher' was found in the previous credential store. Copy it to the new store? [y/N]
```

Enter `Y` to copy just that publisher's PAT and continue without re-entering it. Enter `N` (or press Enter) to continue to the normal PAT prompt without copying anything. Migration is skipped in non-interactive runs such as CI.

- **Windows:** reads the requested Windows Credential Manager entry using the built-in Windows PowerShell. No `keytar` installation is needed.
- **Linux:** requires `secret-tool` (`libsecret-tools` on Debian/Ubuntu) and access to the same desktop Secret Service used previously. You may be prompted to unlock the keyring.
- **macOS:** existing Keychain entries are already compatible; no copying is necessary.

Existing PATs in the new store take precedence; migration does not run while listing publishers or logging out. Each copied PAT is read back before it is used. **Old keytar entries are never modified or deleted**, so older `vsce` versions can still use them. Declining or logging out does not permanently suppress the offer: the old PAT can be offered again when needed, but copying always requires fresh consent. Logout removes only the new entry and does not revoke the PAT.

Credential writes are serialized across `vsce` processes, and the destination is checked again after confirmation to avoid overwriting a newer PAT. The non-secret lock lives under `~/.vsce-keytar-migration`; no PATs or consent decisions are stored there. A command waits up to 30 seconds for the lock; a lock abandoned by a crashed process can be recovered after two minutes.

If legacy lookup or copying fails, `vsce` displays a warning and continues to the normal PAT prompt. Install the required helper/unlock the keyring and retry, or enter a PAT to save it normally. Migration helpers time out after 30 seconds. Using `VSCE_STORE=file`, `VSCE_PAT`, or `--pat` does not trigger this native-store migration; the existing plaintext-file migration is unchanged.

## Usage

```console
$ npx @vscode/vsce --version
```

`@vscode/vsce` is meant to be mainly used as a command-line tool. It can also be used as a library since it exposes a small [API](https://github.com/microsoft/vscode-vsce/blob/main/src/api.ts). When using `@vscode/vsce` as a library, be sure to sanitize any user input used in API calls to prevent security issues.

Supported package managers:

- `npm >=6`
- `yarn >=1 <2`

## Configuration

You can configure the behavior of `vsce` by using CLI flags (run `vsce --help` to list them all). Example:

```console
$ npx @vscode/vsce publish --baseImagesUrl https://my.custom/base/images/url
```

You can define the options for `publish` and `package` the `package.json` under the `vsce` property, so that you avoid having to retype the common options again. Example:

```jsonc
// package.json
{
  "vsce": {
    "baseImagesUrl": "https://my.custom/base/images/url",
    "dependencies": true,
    "yarn": false
  }
}
```

### Trusted publishing

`vsce publish --oidc` publishes from GitHub Actions without storing a Personal Access Token. Configure a trusted
publishing policy for the repository and workflow on the Visual Studio Marketplace, then grant the workflow permission
to request an OIDC token:

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx @vscode/vsce publish --oidc
```

OIDC publishing requests a GitHub Actions token for the `marketplace.visualstudio.com` audience and exchanges it for a
short-lived Marketplace credential. It does not fall back to a PAT when token acquisition or exchange fails.

## Development

First clone this repository, then:

```console
$ npm install
$ npm run watch:build # or `watch:test` to also build tests
```

Once the watcher is up and running, you can run out of sources with:

```console
$ node vsce
```

Tests can be executed with:

```console
$ npm test
```

> **Note:** [Yarn](https://www.npmjs.com/package/yarn) is required to run the tests.
