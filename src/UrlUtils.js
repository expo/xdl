'use strict';

import crayon from '@ccheever/crayon';
import ip from 'ip';
import myLocalIp from 'my-local-ip';
import os from 'os';
import url from 'url';

export function constructBundleUrl(packageController, opts) {
  return constructUrl(packageController, opts, 'bundle');
}

export function constructManifestUrl(packageController, opts) {
  return constructUrl(packageController, opts, null);
}

export function constructPublishUrl(packageController) {
  return constructBundleUrl(packageController, {
    ngrok: true,
    http: true,
  }) + '?' + constructBundleQueryParams({
    dev: false,
    minify: true,
  });
}

export function constructDebuggerHost(packageController) {
  return ip.address() + ':' + packageController.opts.packagerPort;
}

export function constructBundleQueryParams(opts) {
  let queryParams = 'dev=' + encodeURIComponent(!!opts.dev);

  if (opts.hasOwnProperty('strict')) {
    queryParams += '&strict=' + encodeURIComponent(!!opts.strict);
  }

  if (opts.minify) {
    queryParams += '&minify=' + encodeURIComponent(!!opts.minify);
  }

  return queryParams;
}

export function constructUrl(packageController, opts, path) {
  opts = opts || {};

  let protocol = 'exp';
  if (opts.http) {
    protocol = 'http';
  }

  let hostname;
  let port;

  if (opts.localhost) {
    hostname = 'localhost';
    port = packageController.opts.port;
  } else if (opts.lan) {
    hostname = os.hostname();
    port = packageController.opts.port;
  } else if (opts.lanIp) {
    hostname = myLocalIp;
    port = packageController.opts.port;
  } else {
    let ngrokUrl = packageController.getNgrokUrl();
    if (!ngrokUrl) {
      throw new Error("Can't get ngrok URL because ngrok not started yet");
    }

    let pnu = url.parse(ngrokUrl);
    hostname = pnu.hostname;
    port = pnu.port;
  }

  let url_ = protocol + '://' + hostname;
  if (port) {
    url_ += ':' + port;
  }

  if (path) {
    url_ += '/' + path;
  }

  if (opts.redirect) {
    return 'http://exp.host/--/to-exp/' + encodeURIComponent(url_);
  }

  return url_;
}

export function expUrlFromHttpUrl(url_) {
  return ('' + url_).replace(/^http(s?)/, 'exp');
}

export function httpUrlFromExpUrl(url_) {
  return ('' + url_).replace(/^exp(s?)/, 'http');
}

export function guessMainModulePath(entryPoint) {
  return entryPoint.replace(/\.js$/, '');
}

export function randomIdentifier(length=6) {
  let alphabet = '23456789qwertyuipasdfghjkzxcvbnm';
  let result = '';
  for (let i = 0; i < length; i++) {
    let j = Math.floor(Math.random() * alphabet.length);
    let c = alphabet.substr(j, 1);
    result += c;
  }
  return result;

}

export function sevenDigitIdentifier() {
  return randomIdentifier(3) + '-' + randomIdentifier(4);
}

export function randomIdentifierForUser(username) {
  return username + '-' + randomIdentifier(3) + '-' + randomIdentifier(2);
}
