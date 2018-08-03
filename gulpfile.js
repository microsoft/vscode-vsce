'use strict';

const path = require('path');
const gulp = require('gulp');
const gts = require('gulp-typescript');
const sm = require('gulp-sourcemaps');
const filter = require('gulp-filter');
const tslint = require('gulp-tslint');
const rimraf = require('rimraf');
const es = require('event-stream');
const cp = require('child_process');

const project = gts.createProject('tsconfig.json');

function compile() {
	const tsd = filter(['**', '!**/*.d.ts'], { restore: true });

	const ts = project.src()
		.pipe(tsd)
		.pipe(tslint())
		.pipe(tslint.report({ summarizeFailureOutput: true, emitError: false }))
		.pipe(tsd.restore)
		.pipe(sm.init())
		.pipe(project());

	const js = ts.js
		.pipe(sm.write('.', {
			includeContent: false, sourceRoot: file => {
				const dirname = path.dirname(file.relative);
				return dirname === '.' ? '../src' : ('../src/' + dirname);
			}
		}));

	const api = ts.dts
		.pipe(filter('**/api.d.ts'));

	const resources = gulp.src('src/**', { dot: true })
		.pipe(filter(['**', '!**/*.ts'], { dot: true }));

	return es.merge(js, api, resources)
		.pipe(gulp.dest('out'));
}

gulp.task('clean', cb => rimraf('out', cb));
gulp.task('compile', ['clean'], compile);
gulp.task('just-compile', compile);

function test(cb) {
	const child = cp.spawn('mocha', ['--reporter=dot'], { stdio: 'inherit' });
	child.on('exit', () => cb());
}

gulp.task('test', ['compile'], test);
gulp.task('just-test', ['just-compile'], test);

function watch(task) {
	return cb => gulp.watch(['src/**', 'typings/**'], [task]);
}

gulp.task('watch', ['compile'], watch('just-compile'));
gulp.task('watch-test', ['compile'], watch('just-test'));

gulp.task('default', ['watch']);