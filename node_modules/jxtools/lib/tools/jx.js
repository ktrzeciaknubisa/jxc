// Copyright & License details are available under JXCORE_LICENSE file

var path = require('path');
var fs = require('fs');
var os = require('os');
var cp = require('child_process');
var _fs = require('./fs.js');
var _http = require('./http.js');

exports.isJXcore = typeof process.versions.jxcore !== 'undefined';
exports.homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

var isWindows = process.platform === 'win32';

/**
 * Exits the process if we're not running under JXcore
 * @param methodName
 */
exports.onlyForJXcore = function (methodName) {

  if (!exports.isJXcore) {
    if (methodName) {
      jxcore.utils.console.write('\nThe following method is designed to work only with JXcore: ', 'red');
      jxcore.utils.console.error(methodName, '.', 'yellow');
    } else {
      jxcore.utils.console.error('\nThis command is designed to work only with JXcore.');
    }

    jxcore.utils.console.log('You may want to use `jx install` rather than `npm install` for installing', path.basename(process.argv[1]), '.');
    process.exit();
  }
};

var returnError = function (err, verbose) {
  if (verbose)
    jxcore.utils.console.error(err);
  return {err: err};
};

//
/**
 * Creates app home dir if does not exists. Always in HOME dir: ~/.{app}
 * @param app
 * @param verbose
 * @return {string} returns path for app home dir or { err : "msg" }
 */
exports.checkHomeDir = function (app, verbose) {

  if (!app)
    return returnError('Method checkHomeDir() expects an app name to be given.', verbose);

  if (typeof app !== 'string')
    return returnError('Method checkHomeDir() expects an app name to be a string.', verbose);

  if (app.slice(0, 1) !== '.')
    app = '.' + app;

  var homeDir = path.join(exports.homeDir, app);

  if (!fs.existsSync(homeDir)) {
    try {
      fs.mkdirSync(homeDir);
    } catch (ex) {
      return returnError('Cannot create ' + homeDir + ':\n' + ex, verbose);
    }
  }

  return homeDir;
};

/**
 * Instead of e.g. "v Beta-0.2.3.7" returns "0237"
 * @param versionString
 * @return {*}
 */
exports.normalizeJXcoreVersion = function (versionString) {

  if (!versionString)
    return "";

  var v = versionString.trim().replace(/\.|v|-|\s|beta/gi, "");
  while (v.slice(0, 1) === "0")
    v = v.slice(1);

  if (v.length === 3)
    v = "0" + v;

  return v;
};

/**
 * Instead of e.g. x32 returns 32
 * @param archString
 * @return {*}
 */
exports.normalizeArchitecture = function (archString) {

  if (archString)
    archString = archString.replace(/x|ia/gi, "");

  if (archString === "32" || archString === "64")
    return archString;

  return process.arch.replace(/x|ia/gi, "");
};


/**
 * Searches for jx binary in local folder and PATH
 * @options { extraPaths : [], minVersion : '0.3.0.1' }
 * @param cb (err, jxPath)
 * @return {*}
 */
exports.findJX = function(options, cb) {

  var minVersion = exports.normalizeJXcoreVersion(options ? options.minVersion : null);
  if (minVersion) minVersion = parseInt(minVersion);

  var needNewer = function(version) {
    if (!version)
      return true;

    version = exports.normalizeJXcoreVersion(version);
    var v = parseInt(version);
    if (isNaN(v))
      return true;

    return v < minVersion;
  };

  if (process.jxversion && !needNewer(process.jxversion))
    return cb(null, process.execPath);

  // returns first valid jx from given array of paths
  var findValidJX = function(files, cb) {

    var _next = function() {
      var f = files.shift();
      if (!f) return cb('None of the following paths are valid jx binaries: ' + files.join(','));

      f = path.normalize(f);
      if (!fs.existsSync(f))
        return _next();

      cp.exec(f + ' -jxv', { timeout : 1000 }, function(err, stdout, stderr) {
        if (!err) {
          if (needNewer(stdout + ''))
            return _next();
          else
            return cb(null, f);
        } else {
          return _next();
        }
      });
    };

    _next();
  };

  var testFiles = [];

  var local = path.join(process.cwd(), isWindows ? 'jx.exe' : 'jx');
  if (fs.existsSync(local))
    testFiles.push(local);

  if (options.extraPaths) {
    for(var o in options.extraPaths)
      if (options.extraPaths.hasOwnProperty(o) && testFiles.indexOf(options.extraPaths[o]) === -1)
        testFiles.push(options.extraPaths[o]);
  }

  var cmd = isWindows ? 'where jx' : 'which -a jx';
  cp.exec(cmd, function(err, stdout, stderr) {
    if (err && !testFiles.length)
      return cb('Cannot find jx in path.');

    var arr = stdout.toString().trim().split(os.EOL);
    for(var o in arr) {
      var _p = arr[o].trim();
      if (_p && arr.hasOwnProperty(o) && testFiles.indexOf(_p) === -1)
        testFiles.push(_p);
    }

    findValidJX(testFiles, cb);
  });
};

/**
 *
 * @param options { outputDir : "/path", extraPaths : [] }
 * @param cb
 */
exports.findOrDownloadJXcore = function(options, cb) {

  exports.findJX(options, function(err, jxPath) {
    if (!err)
      return cb(null, jxPath);

    _http.downloadLatestJXcore(function(err1, jxPath1) {
      if (err1)
        return cb(err1);

      if (!options.outputDir)
        return cb(null, jxPath1);

      var outputFile = path.join(options.outputDir, path.basename(jxPath1));
      var ret = _fs.moveExecutableSync(jxPath1, outputFile);
      if (ret.err)
        cb(ret.err);
      else
        cb(null, outputFile);
    });

  });

};


exports.readBinaryInfo = function (jxPath, cb) {
  var cmd = [];
  cmd.push({name: "jxv", command: '"' + jxPath + '" -jxv'});
  cmd.push({name: "arch", command: '"' + jxPath + '" -p process.arch'});
  cmd.push({name: "jsv", command: '"' + jxPath + '" -jsv'});
  cmd.push({name: "engine", command: '"' + jxPath + '" -p "process.versions.sm ? \'sm\' : \'v8\'"'});
  cmd.push({name: "engine2", command: '"' + jxPath + '" -p "process.versions.sm || process.versions.v8'});

  if (isWindows)
    cmd.push({name: "which", command: 'where jx'});
  else
    cmd.push({name: "which", command: 'which -a jx'});

  var ret = {err: false};
  ret.caption = "";

  _fs.execMultiple(cmd, {timeout: 1000, skipError: true}, function (ret) {

    for (var o in ret) {
      if (ret[o].err && ret[o].err.toString("unrecognized flag") !== -1) {
        // remove errors with unrecognized flag (older jx version may not support e.g. -jsv)
        ret[o] = "";
      }
    }

    if (ret.which) {
      var arr = ret.which.split('\n');
      ret.which = [];
      for(var o in arr)
        if (arr.hasOwnProperty(o) && ret.which.indexOf(arr[o]) === -1)
          ret.which.push(arr[o]);
    }

    ret.caption = "";
    if (ret.jxv) ret.caption = "JXcore " + ret.jxv;
    if (ret.arch) ret.caption += ", " + ret.arch;
    if (ret.jsv) ret.caption += ", " + ret.jsv;
    else if (ret.engine) ret.caption += ", " + ret.engine + ' ' + (ret.engine2 || "");
    cb(ret);
  });
};


