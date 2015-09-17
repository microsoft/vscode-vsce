import gulp from 'gulp';
import tsb from 'gulp-tsb';
import filter from 'gulp-filter';
import rimraf from 'rimraf';
import { merge } from 'event-stream';
import { compilerOptions } from './tsconfig.json';

const compilation = tsb.create(compilerOptions);

const compile = () => {
	const ts = filter('**/*.ts', { restore: true });
	const input = merge(
		gulp.src('src/**', { base: 'src' }),
		gulp.src('typings/**/*.d.ts')
	);
	
	return input
		.pipe(ts)
		.pipe(compilation())
		.pipe(ts.restore)
		.pipe(gulp.dest('out'));
};

gulp.task('clean', cb => rimraf('out', cb));
gulp.task('compile', ['clean'], compile);
gulp.task('compile-only', compile);
gulp.task('watch', ['compile'], () => gulp.watch(['src/**', 'typings/**'], ['compile-only']));
