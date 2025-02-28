import { Command, Option } from 'commander';
import leven from 'leven';
import { packageCommand, ls, Targets, generateManifest, verifySignature } from './package';
import { publish, unpublish } from './publish';
import { show } from './show';
import { search } from './search';
import { listPublishers, deletePublisher, loginPublisher, logoutPublisher, verifyPat } from './store';
import { getLatestVersion } from './npm';
import { CancellationToken, log } from './util';
import * as semver from 'semver';
import { isatty } from 'tty';

const pkg = require('../package.json');

function fatal(message: any, ...args: any[]): void {
	if (message instanceof Error) {
		if (process.env['VSCE_DEBUG']) {
			console.error(message);
		}

		message = message.message;

		if (/^cancell?ed$/i.test(message)) {
			return;
		}
	}

	log.error(message, ...args);

	if (/Unauthorized\(401\)/.test(message)) {
		log.error(`Be sure to use a Personal Access Token which has access to **all accessible accounts**.
See https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions for more information.`);
	}

	process.exit(1);
}

function main(task: Promise<any>): void {
	let latestVersion: string | null = null;

	const token = new CancellationToken();

	if (isatty(1)) {
		getLatestVersion(pkg.name, token)
			.then(version => (latestVersion = version))
			.catch(_ => {
				/* noop */
			});
	}

	task.catch(fatal).then(() => {
		if (latestVersion && semver.gt(latestVersion, pkg.version)) {
			log.warn(`The latest version of ${pkg.name} is ${latestVersion} and you have ${pkg.version}.\nUpdate it now: npm install -g ${pkg.name}`);
		} else {
			token.cancel();
		}
	});
}

const ValidTargets = [...Targets].join(', ');

module.exports = function (argv: string[]): void {
	const program = new Command();

	program.version(pkg.version).usage('<command>');

	program
		.command('ls')
		.description('Lists all the files that will be published/packaged')
		.option('--tree', 'Prints the files in a tree format', false)
		.option('--yarn', 'Use yarn instead of npm (default inferred from presence of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from absence of yarn.lock or .yarnrc)')
		.option<string[]>(
			'--packagedDependencies <path>',
			'Select packages that should be published only (includes dependencies)',
			(val, all) => (all ? all.concat(val) : [val]),
			undefined
		)
		.option('--ignoreFile <path>', 'Indicate alternative .vscodeignore')
		// default must remain undefined for dependencies or we will fail to load defaults from package.json
		.option('--dependencies', 'Enable dependency detection via npm or yarn', undefined)
		.option('--no-dependencies', 'Disable dependency detection via npm or yarn', undefined)
		.option('--readme-path <path>', 'Path to README file (defaults to README.md)')
		.option('--follow-symlinks', 'Recurse into symlinked directories instead of treating them as files')
		.action(({ tree, yarn, packagedDependencies, ignoreFile, dependencies, readmePath, followSymlinks }) =>
			main(ls({ tree, useYarn: yarn, packagedDependencies, ignoreFile, dependencies, readmePath, followSymlinks }))
		);

	program
		.command('package [version]')
		.alias('pack')
		.description('Packages an extension')
		.option('-o, --out <path>', 'Output .vsix extension file to <path> location (defaults to <name>-<version>.vsix)')
		.option('-t, --target <target>', `Target architecture. Valid targets: ${ValidTargets}`)
		.option('--ignore-other-target-folders', `Ignore other target folders. Valid only when --target <target> is provided.`)
		.option('--readme-path <path>', 'Path to README file (defaults to README.md)')
		.option('--changelog-path <path>', 'Path to CHANGELOG file (defaults to CHANGELOG.md)')
		.option('-m, --message <commit message>', 'Commit message used when calling `npm version`.')
		.option(
			'--no-git-tag-version',
			'Do not create a version commit and tag when calling `npm version`. Valid only when [version] is provided.'
		)
		.option('--no-update-package-json', 'Do not update `package.json`. Valid only when [version] is provided.')
		.option(
			'--githubBranch <branch>',
			'The GitHub branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option(
			'--gitlabBranch <branch>',
			'The GitLab branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option('--no-rewrite-relative-links', 'Skip rewriting relative links.')
		.option('--baseContentUrl <url>', 'Prepend all relative links in README.md with the specified URL.')
		.option('--baseImagesUrl <url>', 'Prepend all relative image links in README.md with the specified URL.')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presence of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from absence of yarn.lock or .yarnrc)')
		.option('--ignoreFile <path>', 'Indicate alternative .vscodeignore')
		.option('--no-gitHubIssueLinking', 'Disable automatic expansion of GitHub-style issue syntax into links')
		.option('--no-gitLabIssueLinking', 'Disable automatic expansion of GitLab-style issue syntax into links')
		// default must remain undefined for dependencies or we will fail to load defaults from package.json
		.option('--dependencies', 'Enable dependency detection via npm or yarn', undefined)
		.option('--no-dependencies', 'Disable dependency detection via npm or yarn', undefined)
		.option('--pre-release', 'Mark this package as a pre-release')
		.option('--allow-star-activation', 'Allow using * in activation events')
		.option('--allow-missing-repository', 'Allow missing a repository URL in package.json')
		.option('--allow-unused-files-pattern', 'Allow include patterns for the files field in package.json that does not match any file')
		.option('--skip-license', 'Allow packaging without license file')
		.option('--sign-tool <path>', 'Path to the VSIX signing tool. Will be invoked with two arguments: `SIGNTOOL <path/to/extension.signature.manifest> <path/to/extension.signature.p7s>`.')
		.option('--follow-symlinks', 'Recurse into symlinked directories instead of treating them as files')
		.action(
			(
				version,
				{
					out,
					target,
					ignoreOtherTargetFolders,
					readmePath,
					changelogPath,
					message,
					gitTagVersion,
					updatePackageJson,
					githubBranch,
					gitlabBranch,
					rewriteRelativeLinks,
					baseContentUrl,
					baseImagesUrl,
					yarn,
					ignoreFile,
					gitHubIssueLinking,
					gitLabIssueLinking,
					dependencies,
					preRelease,
					allowStarActivation,
					allowMissingRepository,
					allowUnusedFilesPattern,
					skipLicense,
					signTool,
					followSymlinks,
				}
			) =>
				main(
					packageCommand({
						packagePath: out,
						version,
						target,
						ignoreOtherTargetFolders,
						readmePath,
						changelogPath,
						commitMessage: message,
						gitTagVersion,
						updatePackageJson,
						githubBranch,
						gitlabBranch,
						rewriteRelativeLinks,
						baseContentUrl,
						baseImagesUrl,
						useYarn: yarn,
						ignoreFile,
						gitHubIssueLinking,
						gitLabIssueLinking,
						dependencies,
						preRelease,
						allowStarActivation,
						allowMissingRepository,
						allowUnusedFilesPattern,
						skipLicense,
						signTool,
						followSymlinks,
					})
				)
		);

	program
		.command('publish [version]')
		.description('Publishes an extension')
		.option(
			'-p, --pat <token>',
			'Personal Access Token (defaults to VSCE_PAT environment variable)',
			process.env['VSCE_PAT']
		)
		.option('--azure-credential', 'Use Microsoft Entra ID for authentication')
		.option('-t, --target <targets...>', `Target architectures. Valid targets: ${ValidTargets}`)
		.option('--ignore-other-target-folders', `Ignore other target folders. Valid only when --target <target> is provided.`)
		.option('--readme-path <path>', 'Path to README file (defaults to README.md)')
		.option('--changelog-path <path>', 'Path to CHANGELOG file (defaults to CHANGELOG.md)')
		.option('-m, --message <commit message>', 'Commit message used when calling `npm version`.')
		.option(
			'--no-git-tag-version',
			'Do not create a version commit and tag when calling `npm version`. Valid only when [version] is provided.'
		)
		.option('--no-update-package-json', 'Do not update `package.json`. Valid only when [version] is provided.')
		.option('-i, --packagePath <paths...>', 'Publish the provided VSIX packages.')
		.option('--manifestPath <paths...>', 'Manifest files to publish alongside the VSIX packages.')
		.option('--signaturePath <paths...>', 'Signature files to publish alongside the VSIX packages.')
		.option('--sigzipPath <paths...>', 'Signature archives to publish alongside the VSIX packages.')
		.option('--sign-tool <path>', 'Path to the VSIX signing tool. Will be invoked with two arguments: `SIGNTOOL <path/to/extension.signature.manifest> <path/to/extension.signature.p7s>`. This will be ignored if --sigzipPath is provided.')
		.option(
			'--githubBranch <branch>',
			'The GitHub branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option(
			'--gitlabBranch <branch>',
			'The GitLab branch used to infer relative links in README.md. Can be overridden by --baseContentUrl and --baseImagesUrl.'
		)
		.option('--baseContentUrl <url>', 'Prepend all relative links in README.md with the specified URL.')
		.option('--baseImagesUrl <url>', 'Prepend all relative image links in README.md with the specified URL.')
		.option('--yarn', 'Use yarn instead of npm (default inferred from presence of yarn.lock or .yarnrc)')
		.option('--no-yarn', 'Use npm instead of yarn (default inferred from absence of yarn.lock or .yarnrc)')
		.option('--no-verify', 'Allow all proposed APIs (deprecated: use --allow-all-proposed-apis instead)')
		.addOption(new Option('--noVerify', 'Allow all proposed APIs (deprecated: use --allow-all-proposed-apis instead)').hideHelp(true))
		.option('--allow-proposed-apis <apis...>', 'Allow specific proposed APIs')
		.option('--allow-all-proposed-apis', 'Allow all proposed APIs')
		.option('--ignoreFile <path>', 'Indicate alternative .vscodeignore')
		// default must remain undefined for dependencies or we will fail to load defaults from package.json
		.option('--dependencies', 'Enable dependency detection via npm or yarn', undefined)
		.option('--no-dependencies', 'Disable dependency detection via npm or yarn', undefined)
		.option('--pre-release', 'Mark this package as a pre-release')
		.option('--allow-star-activation', 'Allow using * in activation events')
		.option('--allow-missing-repository', 'Allow missing a repository URL in package.json')
		.option('--allow-unused-files-pattern', 'Allow include patterns for the files field in package.json that does not match any file')
		.option('--skip-duplicate', 'Fail silently if version already exists on the marketplace')
		.option('--skip-license', 'Allow publishing without license file')
		.option('--follow-symlinks', 'Recurse into symlinked directories instead of treating them as files')
		.action(
			(
				version,
				{
					pat,
					azureCredential,
					target,
					ignoreOtherTargetFolders,
					readmePath,
					changelogPath,
					message,
					gitTagVersion,
					updatePackageJson,
					packagePath,
					manifestPath,
					signaturePath,
					sigzipPath,
					githubBranch,
					gitlabBranch,
					baseContentUrl,
					baseImagesUrl,
					yarn,
					verify,
					noVerify,
					allowProposedApis,
					allowAllProposedApis,
					ignoreFile,
					dependencies,
					preRelease,
					allowStarActivation,
					allowMissingRepository,
					allowUnusedFilesPattern,
					skipDuplicate,
					skipLicense,
					signTool,
					followSymlinks,
				}
			) =>
				main(
					publish({
						pat,
						azureCredential,
						version,
						targets: target,
						ignoreOtherTargetFolders,
						readmePath,
						changelogPath,
						commitMessage: message,
						gitTagVersion,
						updatePackageJson,
						packagePath,
						manifestPath,
						signaturePath,
						sigzipPath,
						githubBranch,
						gitlabBranch,
						baseContentUrl,
						baseImagesUrl,
						useYarn: yarn,
						noVerify: noVerify || !verify,
						allowProposedApis,
						allowAllProposedApis,
						ignoreFile,
						dependencies,
						preRelease,
						allowStarActivation,
						allowMissingRepository,
						allowUnusedFilesPattern,
						skipDuplicate,
						skipLicense,
						signTool,
						followSymlinks
					})
				)
		);

	program
		.command('unpublish [extensionid]')
		.description('Unpublishes an extension. Example extension id: ms-vscode.live-server.')
		.option('-p, --pat <token>', 'Personal Access Token')
		.option('--azure-credential', 'Use Microsoft Entra ID for authentication')
		.option('-f, --force', 'Skip confirmation prompt when unpublishing an extension')
		.action((id, { pat, azureCredential, force }) => main(unpublish({ id, pat, azureCredential, force })));

	program
		.command('generate-manifest')
		.description('Generates the extension manifest from the provided VSIX package.')
		.requiredOption('-i, --packagePath <path>', 'Path to the VSIX package')
		.option('-o, --out <path>', 'Output the extension manifest to <path> location (defaults to <packagename>.manifest)')
		.action(({ packagePath, out }) => main(generateManifest(packagePath, out)));

	program
		.command('verify-signature')
		.description('Verifies the provided signature file against the provided VSIX package and manifest.')
		.requiredOption('-i, --packagePath <path>', 'Path to the VSIX package')
		.requiredOption('-m, --manifestPath <path>', 'Path to the Manifest file')
		.requiredOption('-s, --signaturePath <path>', 'Path to the Signature file')
		.action(({ packagePath, manifestPath, signaturePath }) => main(verifySignature(packagePath, manifestPath, signaturePath)));

	program
		.command('ls-publishers')
		.description('Lists all known publishers')
		.action(() => main(listPublishers()));

	program
		.command('delete-publisher <publisher>')
		.description('Deletes a publisher from marketplace')
		.action(publisher => main(deletePublisher(publisher)));

	program
		.command('login <publisher>')
		.description('Adds a publisher to the list of known publishers')
		.action(name => main(loginPublisher(name)));

	program
		.command('logout <publisher>')
		.description('Removes a publisher from the list of known publishers')
		.action(name => main(logoutPublisher(name)));

	program
		.command('verify-pat [publisher]')
		.description('Verifies if the Personal Access Token or Azure identity has publish rights for the publisher')
		.option(
			'-p, --pat <token>',
			'Personal Access Token (defaults to VSCE_PAT environment variable)',
			process.env['VSCE_PAT']
		)
		.option('--azure-credential', 'Use Microsoft Entra ID for authentication')
		.action((publisherName, { pat, azureCredential }) => main(verifyPat({ publisherName, pat, azureCredential })));

	program
		.command('show <extensionid>')
		.description(`Shows an extension's metadata`)
		.option('--json', 'Outputs data in json format', false)
		.action((extensionid, { json }) => main(show(extensionid, json)));

	program
		.command('search <text>')
		.description('Searches extension gallery')
		.option('--json', 'Output results in json format', false)
		.option('--stats', 'Shows extensions rating and download count', false)
		.option('-p, --pagesize [value]', 'Number of results to return', '100')
		.action((text, { json, pagesize, stats }) => main(search(text, json, parseInt(pagesize), stats)));

	program.on('command:*', ([cmd]: string) => {
		if (cmd === 'create-publisher') {
			log.error(
				`The 'create-publisher' command is no longer available. You can create a publisher directly in the Marketplace: https://aka.ms/vscode-create-publisher`
			);

			process.exit(1);
		}

		program.outputHelp(help => {
			const availableCommands = program.commands.map(c => c.name());
			const suggestion = availableCommands.find(c => leven(c, cmd) < c.length * 0.4);

			help = `${help}\n Unknown command '${cmd}'`;

			return suggestion ? `${help}, did you mean '${suggestion}'?\n` : `${help}.\n`;
		});
		process.exit(1);
	});

	program.description(`${pkg.description}
To learn more about the VS Code extension API: https://aka.ms/vscode-extension-api
To connect with the VS Code extension developer community: https://aka.ms/vscode-discussions`);

	program.parse(argv);
};
