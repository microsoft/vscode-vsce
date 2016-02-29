import * as path from 'path';
import * as cp from 'child_process';

const listCmd = 'npm list --production --parseable';

export function getDependencies(cwd: string): Promise<string[]> {
	return new Promise<string[]>((c, e) => {
		cp.exec(listCmd, { cwd }, (err, stdout, stderr) => {
				if (err) return e(err);

				c(stdout.toString('utf8')
					.split(/[\r\n]/)
					.filter(dir => path.isAbsolute(dir)));
			}
		);
	});
}