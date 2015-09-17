import gulp from 'gulp';
import tsb from 'gulp-tsb';
import rimraf from 'rimraf';
import { compilerOptions } from './tsconfig.json';

const compilation = tsb.create(compilerOptions);
const src = [
	'src/**/*.ts',	
	'typings/**/*.d.ts'	
];

gulp.task('clean', cb => rimraf('out', cb));

gulp.task('compile', ['clean'], () => {
	return gulp.src(src, { base: 'src' })
		.pipe(compilation()) 
		.pipe(gulp.dest('out'));
});

gulp.task('watch', ['compile'], () => {
	return gulp.watch(src, ['compile']);
});
