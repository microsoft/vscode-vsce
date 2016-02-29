import * as path from 'path';
import * as cp from 'child_process';

const cmd = 'npm list --production --parseable --depth=99999';

export function getDependencies(cwd: string): Promise<string[]> {
	return new Promise<string[]>((c, e) => {
		cp.exec(cmd, { cwd }, (err, stdout, stderr) => {
				if (err) return e(err);

				c(stdout.toString('utf8')
					.split(/[\r\n]/)
					.filter(dir => path.isAbsolute(dir)));
			}
		);
	});
}