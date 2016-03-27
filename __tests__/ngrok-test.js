jest.unmock('../')
jest.autoMockOff();

describe('startInstance', () => {
  pit("Creates an instance of a PackagerController and starts it", async () => {
    let xdl = require('../');
    let pc = xdl.PackagerController.jestInstance();
    let ngrokUrl = await pc.startOrRestartNgrokAsync();
    expect(ngrokUrl).toBeDefined();
  });
});

// TODO: Add ngrok tests here
