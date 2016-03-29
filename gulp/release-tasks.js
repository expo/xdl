import 'instapromise';

import fs from 'fs';
import logger from 'gulplog';
import path from 'path';
import spawnAsync from '@exponent/spawn-async';

const paths = {
  template: path.resolve(__dirname, '../template'),
  templateNodeModules: path.resolve(__dirname, '../template/node_modules'),
}

let tasks = {
  async archiveTemplate() {
    await verifyNodeModulesAsync();
    await spawnAsync('zip', ['-rqy9', 'template.zip', paths.template], {
      stdio: 'inherit',
    });
  }
};

async function verifyNodeModulesAsync() {
  let stats;
  try {
    stats = await fs.promise.stat(paths.templateNodeModules);
  } catch (e) { }

  if (stats) {
    if (!stats.isDirectory()) {
      throw new Error(
        `${paths.templateNodeModules} is not a directory; be sure to run ` +
        `"npm install" before releasing a new version of XDL`
      );
    }
  } else {
    logger.info(`Running "npm install" to set up ${paths.templateNodeModules}...`);
    await spawnAsync('npm', ['install'], {
      stdio: 'inherit',
      cwd: paths.template,
    });
  }
}

export default tasks;
