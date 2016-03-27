require('jasmine-pit').install(global);

describe("Just make sure ngrok runs", function() {
  it("is a test test", function () {
    expect(true).toBeDefined();
  });

  pit("Is an ngrok test", function () {
    var xdl = require('..');
    var pc = xdl.PackagerController.jestInstance();
    return pc.startOrRestartNgrokAsync().then(function (ngrokUrl) {
      expect(ngrokUrl).toBeDefined();
    });
  });

});
