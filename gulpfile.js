'use strict';

const gulp = require('gulp');
const tsb = require('gulp-tsb');
const filter = require('gulp-filter');
const tslint = require('gulp-tslint');
const rimraf = require('rimraf');
const path = require('path');
const es = require('event-stream');
const cp = require('child_process');
const options = require('./tsconfig.json').compilerOptions;
options.sourceMap = true;
options.sourceRoot = path.join(__dirname, 'src');
options.declaration = true;

const compilation = tsb.create(options);

function compile() {
	const ts = filter('**/*.ts', { restore: true });
	const tsd = filter(['**', '!**/*.d.ts'], { restore: true });
	const input = es.merge(
		gulp.src('src/**', { base: 'src', dot: true }),
		gulp.src('typings/**/*.d.ts')
	);

	const result = input
		.pipe(ts)
		.pipe(tsd)
		.pipe(tslint({ configuration: require('./tslint.json') }))
		.pipe(tslint.report({ summarizeFailureOutput: true, emitError: false }))
		.pipe(tsd.restore)
		.pipe(compilation())
		.pipe(ts.restore);

	const api = result
		.pipe(filter('**/api.d.ts'));

	const compiled = result
		.pipe(filter(['**', '!**/*.d.ts']));

	return es.merge(api, compiled)
		.pipe(gulp.dest('out'));
}

gulp.task('clean', cb => rimraf('out', cb));
gulp.task('compile', ['clean'], compile);
gulp.task('just-compile', compile);

function test(cb) {
	const child = cp.spawn('mocha', [], { stdio: 'inherit' });
	child.on('exit', () => cb());
}

gulp.task('test', ['compile'], test);
gulp.task('just-test', ['just-compile'], test);

function watch(task) {
	return () => gulp.watch(['src/**', 'typings/**'], [task]);
}

gulp.task('watch', ['compile'], watch('just-compile'));
gulp.task('watch-test', ['compile'], watch('just-test'));

gulp.task('default', ['watch']);