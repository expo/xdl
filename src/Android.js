import spawnAsync from '@exponent/spawn-async';

async function installExponentWithAdbAsync() {
  return await openUrlWithAdbAsync('market://details?id=host.exp.exponent');
}

async function openUrlWithAdbAsync(url) {
  return await spawnAsync('./adb', ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url], {
    cwd: __dirname + '/../',
  });
}

module.exports = {
  installExponentWithAdbAsync,
  openUrlWithAdbAsync,
};
