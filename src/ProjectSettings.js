var instapromise = require('instapromise');
var jsonFile = require('@exponent/json-file');
var path = require('path');

var projectSettingsDefaults = {
  hostType: 'ngrok',
  dev: true,
  strict: false,
  minify: false,
  urlType: 'exp',
};

function projectSettingsJsonFile(projectRoot) {
  return new jsonFile(path.join(projectRoot, '.exponent'));
}

async function readAsync(projectRoot) {
  let projectSettings;
  try {
    projectSettings = await projectSettingsJsonFile(projectRoot).readAsync();
  } catch (e) {
    projectSettings = await projectSettingsJsonFile(projectRoot).writeAsync(projectSettingsDefaults);
  }

  return projectSettings;
}

async function setAsync(projectRoot, options) {
  let projectSettings = await projectSettingsJsonFile(projectRoot).mergeAsync(options, {cantReadFileDefault: projectSettingsDefaults});
  return projectSettings;
}

module.exports = {
  projectSettingsJsonFile,
  readAsync,
  setAsync,
};
