import 'instapromise';

import gulp from 'gulp';

import buildTasks from './gulp/build-tasks';
import releaseTasks from './gulp/release-tasks';

let tasks = {
  ...buildTasks,
  ...releaseTasks,
};

gulp.task('build', tasks.babel);
gulp.task('watch', gulp.series(tasks.babel, tasks.watchBabel));
gulp.task('clean', tasks.clean);

gulp.task('release', gulp.parallel(
  gulp.series(tasks.clean, tasks.babel),
  tasks.archiveTemplate,
));

gulp.task('default', gulp.series('watch'));
