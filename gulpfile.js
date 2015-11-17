var gulp = require('gulp');
var tsb = require('gulp-tsb');
var filter = require('gulp-filter');
var rimraf = require('rimraf');
var path = require('path');
var es = require('event-stream');
var cp = require('child_process');
var options = require('./tsconfig.json').compilerOptions;

options.sourceMap = true;
options.sourceRoot = path.join(__dirname, 'src');

var compilation = tsb.create(options);

var compile = function () {
	var ts = filter('**/*.ts', { restore: true });
	var input = es.merge(
		gulp.src('src/**', { base: 'src', dot: true }),
		gulp.src('typings/**/*.d.ts')
	);
	
	return input
		.pipe(ts)
		.pipe(compilation())
		.pipe(ts.restore)
		.pipe(gulp.dest('out'));
};

gulp.task('clean', function (cb) { rimraf('out', cb); });
gulp.task('compile', ['clean'], compile);
gulp.task('compile-only', compile);

gulp.task('test', function (cb) {
	var child = cp.spawn('mocha', ['--reporter=dot'], { stdio: 'inherit' });
	child.on('exit', function (code) { cb(); });
});

gulp.task('watch', ['compile', 'test'], function () {
	gulp.watch(['src/**', 'typings/**'], ['compile-only', 'test']);
});
