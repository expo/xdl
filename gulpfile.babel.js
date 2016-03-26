'use strict';

import gulp from 'gulp';
import shell from 'gulp-shell';

gulp.task('build', shell.task(['babel -d build/ src/']));
gulp.task('watch', shell.task(['babel -w -d build/ src/']));
gulp.task('default', gulp.series('watch'));
