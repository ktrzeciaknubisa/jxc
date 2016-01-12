// Copyright & License details are available under JXCORE_LICENSE file

var fs = require("fs");
var path = require("path");
var events = require('events');
var url = require('url');
var https = require('https');
var http = require('http');
var ProgressBar = require('progress');
var zip = require('./zip.js')
var consoleEx = require('./console.js');
var jx = require('./jx.js');

var isWindows = process.platform === 'win32';

var downloader = function (uri, localFile, options) {

  if (!options)
    options = {};

  var eventEmitter = new events.EventEmitter();
  this.on = function (event, listener) {
    eventEmitter.on(event, listener);
  };
  var silent = options.silent || false;
  var attempts = options.attempts || 1;
  var attemptId = 1;
  var req = null;
  if (localFile)
    var dir = path.dirname(localFile);

  var _exit = function (err, tryNext, result) {
    if (req) {
      req.abort();
      req = null;
    }

    if (err) {
      //console.log('exit1');
      if (attemptId < attempts && tryNext) {
        //console.log('exit2');
        attemptId++;
        process.nextTick(_download);
        return;
      }

      if (!silent)
        jxcore.utils.console.error(err);
    }

    process.nextTick(function() {
      eventEmitter.emit('end', err, result);
    });
  };

  if (localFile) {
    try {
      if (!fs.existsSync(dir))
        fs.mkdirSync(dir);
    } catch (ex) {
      return _exit("Cannot create local dir: " + dir + ". " + ex);
    }

    try {
      var file = fs.createWriteStream(localFile);
    } catch (ex) {
      return _exit("Cannot create local file: " + localFile.replace(process.cwd(), "."));
    }
  }

  var _options = url.parse(uri);
  var mod = null;

  if (_options.protocol === 'https:') {
    mod = https;
    _options.rejectUnauthorized = false;
  } else {
    mod = http;
  }

  if (!silent && attemptId == 1)
      consoleEx.logPair("Downloading", uri + "\n", "green");

  var _download = function () {

    if (!silent && attempts !== 1) {
      consoleEx.clearLineAbove();
      console.log("Attempt", attemptId, "/", attempts);
    }

    if (!localFile)
      var fileAsString = "";

    req = mod.get(_options, function (res) {

      var err = false;

      if (res.statusCode !== 200)
        err = "Error status code: " + res.statusCode;

      //if (!res.headers || res.headers["content-type"] !== "application/zip")
      //  err = "Invalid content-type: " + res.headers["content-type"];

      if (err)
        return _exit(err, true);

      var totalLength = parseInt(res.headers["content-length"] || 0, 10);

      var bar = null;
      if (totalLength && !silent) {
        var bar = new ProgressBar(jxcore.utils.console.setColor('Progress:', 'cyan') + ' [:bar] :percent  ' +
        jxcore.utils.console.setColor('Completes in:', 'cyan') + ' :etas', {
          complete: '=',
          incomplete: ' ',
          width: 40,
          total: totalLength
        });
      }

      if (localFile)
        res.pipe(file);

      res.on('data', function (chunk) {

        if (bar) {
          if (!bar.ticked && !silent) {
            consoleEx.clearLineAbove();
            bar.ticked = true;
          }

          bar.tick(chunk.length);
        }

        if (!localFile)
          fileAsString += chunk;

      }).on('end', function () {

        if (!silent) {
          consoleEx.logPairAbove("Progress", 'Done');
        }

        if (localFile) {
          file.on('finish', function () {
            file.close();
            return _exit();
          });

          file.end();
        } else {
          return _exit(false, false, fileAsString);
        }

      });
    }).on('error', function (e) {
      return _exit(e, true);
    });

    if (options.timeout) {
      req.setTimeout(options.timeout, function() {
        req.abort();
      });
    }
  };

  process.nextTick(_download);
};


exports.download = function (url, localFile, options) {
  return new downloader(url, localFile, options);
};

/**
 * Downloads the latest JXcore available for current platform.
 * V8 by default
 * @param cb
 */
exports.downloadJXcore = function(version, engine, arch, cb) {

  var _cb = cb;
  if (typeof version === 'function') {
    _cb = version;
    version = engine = arch = null;
  }
  if (typeof engine === 'function') {
    _cb = engine;
    engine = arch = null;
  }
  if (typeof arch === 'function') {
    _cb = arch;
    arch = null;
  }

  var _go = function(ret) {
    var zipFile = path.join(process.cwd(), 'jx' + Date.now() + '.zip');

    var d = new downloader(ret.url, zipFile);
    d.on('end', function(err1, result) {

      if (err1)
        return _cb('Cannot download JXcore. Required version `' + ret.versionNormalized + '` might not be supported for that platform: ' + ret.basename);

      var unzipper = new zip.Unzipper();
      var fname = isWindows ? 'jx.exe' : 'jx';
      var jxFile = path.join(process.cwd(), fname);

      unzipper.on('end', function (err2) {

        try {
          fs.unlinkSync(zipFile);
        } catch (ex) {}

        if (err2)
          _cb(err2);
        else {

          if (process.platform !== "win32") {
            try {
              fs.chmodSync(jxFile, 0755);
            } catch (ex) {
            }
          }

          _cb(null, jxFile, ret);
        }
      });

      // even on windows it needs / (not \)
      unzipper.unzipFile(zipFile, ret.basename + '/' + fname, process.cwd());
    });
  };

  if (!version || version === 'latest') {
    exports.getLatestInfo(function(err, ret) {
      if (err)
        return _cb(err);

      _go(ret)
    });
  } else {
    var ret = exports.getDownloadPackageInfo(version, engine, arch);
    _go(ret);
  }
};

/**
 * Downloads the latest JXcore available for current platform.
 * V8 by default
 * @param cb
 */
exports.downloadLatestJXcore = function(cb) {
   exports.downloadJXcore('latest', null, null, cb);
};


/**
 * Returns { err, result }
 * @param url
 * @param options
 * @param cb
 */
exports.downloadString = function (url, options, cb) {
  var d = new downloader(url, null, options);
  d.on('end', function(err, result) {
    cb(err, result);
  });
};


/**
 * Returns info about latest JXcore available for download.
 * See ret object.
 * @param cb { err, ret }
 */
exports.getLatestInfo = function (cb) {

  var _url = "https://jxcore.s3.amazonaws.com/latest.txt";
  exports.downloadString(_url, { silent : true }, function(err, str) {
    var ret = null;
    if (err) {
      jxcore.utils.console.error("Cannot fetch JXcore latest release info:", _url);
      jxcore.utils.console.log(err);
    } else {
      // expected body e.g.: https://jxcore.s3.amazonaws.com/0304|Beta-0.3.0.4
      var arr = str.split("|");
      if (arr.length !== 2)
        err = "Invalid data: " + str;

      if (!err) {
        var ret = exports.getDownloadPackageInfo(arr[1]);
        // add extra info
        ret.urlPart = arr[0];  // e.g. https://jxcore.s3.amazonaws.com/0304;
        ret.version = arr[1];  // Beta-0.3.0.4
      }
    }

    cb(err, ret);
  });
};

/**
 * Returns info about download package url
 * {
 *  versionNormalized (e.g. 0237)
 *  engine (sm/v8)
 *  arch (32/64/MIPS/ARM)
 *  basename (e.g. jx_osx64v8)
 *  url (e.g.  https://jxcore.s3.amazonaws.com/0304/jx_osx64v8.zip)
 * }
 * @param version
 * @param engine
 * @param arch
 * @param platform
 */
exports.getDownloadPackageInfo = function(version, engine, arch, platform) {

  engine = engine || 'v8';
  var na = jx.normalizeArchitecture(arch);
  var nv = jx.normalizeJXcoreVersion(version);
  if (nv === "0237")
    engine = 'v8';

  var ret = {
    versionNormalized : nv,
    engine : engine,
    arch : na
  };

  var os_str = jxcore.utils.OSInfo().OS_STR.toLowerCase();
  if (arch)
    os_str = os_str.replace(/ARM|MIPS|64|32/gi, '') + na;

  if (nv === "0237") {
    ret.basename = 'jx_' + os_str;
    ret.url = "https://s3.amazonaws.com/nodejx/" + ret.basename + ".zip";
  } else {
    ret.basename = 'jx_' + os_str + engine;
    ret.url = "https://jxcore.s3.amazonaws.com/" + nv + "/" + ret.basename + ".zip";
  }

  return ret;
};