/**
 * Tests setting up an ngrok tunnel
 *
 */
'use strict'

import promisePrint from 'promise-print';

import xdl from '../../';

async function testNgrokAsync() {
  let PackagerController = xdl.PackagerController;
  let pc = PackagerController.jestInstance();
  let result = await pc.startAsync();
  // let ngrokUrl = await pc.startOrRestartNgrokAsync();
  let ngrokUrl = await pc.getNgrokUrlAsync();
  if (!ngrokUrl) {
    throw new Error("ngrok didn't return a URL");
  }
  await pc.stopAsync();
}

module.exports = {
  testNgrokAsync,
};

if (require.main === module) {
  promisePrint(testNgrokAsync()).then(() => {
    process.exit(0);
  }, (err) => {
    process.exit(-1)
  });
}
