declare module 'libnpmversion' {
  export interface VersionOptions {
    path?: string;
    allowSameVersion?: boolean;
    commitHooks?: boolean;
    gitTagVersion?: boolean;
    signGitCommit?: boolean;
    signGitTag?: boolean;
    force?: boolean;
    ignoreScripts?: boolean;
    scriptShell?: string;
    preid?: string;
    message?: string;
  }

  function libnpmversion(
    version: string,
    options?: VersionOptions
  ): Promise<string>;

  export default libnpmversion;
}