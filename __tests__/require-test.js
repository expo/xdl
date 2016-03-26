jest.unmock('../');
jest.unmock('path');

import path from 'path';

describe('require', () => {
  it("requires xdl and makes sure there are no errors", () => {
    let xdl = require('../');
  });
});

describe('startInstance', () => {
  pit("Creates an instance of a PackagerController and starts it", async () => {
    let xdl = require('../');
    let pc = xdl.PackagerController.jestInstance();
    await pc.startAsync();
    expect(pc).toBeDefined();
    // TODO: Make this work
  });
});
