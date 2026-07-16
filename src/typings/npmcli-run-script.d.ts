declare module "@npmcli/run-script" {
	export interface RunScriptOptions {
		event: string;
		path: string;
		args?: string[];
		stdio?: string | any[];
		env?: Record<string, string>;
	}
	export interface RunScriptResults {
		/**
		 * Process exit code
		 */
		code: number;
		/**
		 * Process exit signal
		 */
		signal: string | null;
		/**
		 * stdout data (Buffer, or String when stdioString set to true)
		 */
		stdout: Buffer | string;
		/**
		 * stderr data (Buffer, or String when stdioString set to true)
		 */
		stderr: Buffer | string;
		/**
		 * Path to the package executing its script
		 */
		path: string;
		/**
		 * Lifecycle event being run
		 */
		event: string;
		/**
		 * Command being run
		 */
		script: string;
	}
	export default function runScript(options: RunScriptOptions): Promise<RunScriptResults>;
}