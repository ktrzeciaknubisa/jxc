// Copyright & License details are available under JXCORE_LICENSE file

var fs = require('fs');
var path = require('path');
var jxtools = require('jxtools');
var fname = 'io.jxcore.node.jx';
var dname = 'io.jxcore.node';
var common = require('../common.js');
var config = require('./config.js');

var localFile = path.join(process.cwd(), fname);
var folder = path.join(process.cwd(), dname);
//var help = common.getHelp('download');

exports.dontCheckCordova = true;

var writeToCache = function(version) {

  jxtools.console.debugInfo('writeToCache called');
  // for now supports only default path commmon.cacheDir

  var dir = path.join(common.cacheDir, version);
  var file = path.join(dir, fname);

  if (!fs.existsSync(common.cacheDir))
      fs.mkdirSync(common.cacheDir);

  if (!fs.existsSync(dir))
    fs.mkdirSync(dir);

  fs.writeFileSync(file, fs.readFileSync(localFile));
};

var unpack = function (jxPath, cb) {

  jxtools.console.debugInfo('unpack called', jxPath);

  var commands = [];
  var cfg = config.read();

  if (fs.existsSync(folder)) {
    commands.push({
      name: 'remove_dir',
      command: jxtools.fs.getRmdirCommand(folder),
      caption: 'Removing previous plugin\'s folder...'
    });
  }

  var extract = {
    name: 'extract',
    command: '"' + jxPath + '" ' + fname,
    caption: 'Extracting plugin package...'
  };

  if (cfg.cache)
    extract.postErrorMessage = 'If you see this error too often, you may try to add --force-download option.';

  // extract package
  commands.push(extract);

  jxtools.fs.execMultiple(commands, function (ret) {
    if (ret.errors)
      return cb(ret.errors);
    else {
      jxcore.utils.console.info("Done.");
      cb();
    }
  });
};


var findJXandUnpack = function(cb) {

  jxtools.console.debugInfo('findJXandUnpack called');

  var opts = {
    outputDir : common.homeDir,
    extraPaths : [ path.join(common.homeDir, process.platform === 'win32' ? 'jx.exe' : 'jx') ],
    minVersion : '0.3.1.0'
  };

  jxtools.findOrDownloadJXcore(opts , function(err, jxPath) {

    jxtools.console.debugInfo('findOrDownloadJXcore callback called', err, jxPath);

    if (err)
      cb(err);
    else
      unpack(jxPath, cb);
  });
};


var download = function(version, cb) {

  var parsedArgv = jxcore.utils.argv.parse();

  var f = path.resolve(version);
  var offFile = null;
  if (fs.existsSync(f))
    offFile = f;
  else
    offFile = checkCachedPackage(version);

  var copied = false;
  if (offFile && !parsedArgv['force-download']) {
    var stat = fs.statSync(offFile);
    if (stat.isDirectory()) {
      jxtools.fs.copySync(offFile, path.join(process.cwd(), common.pluginName));
      return cb();
    }

    try {
      fs.writeFileSync(localFile, fs.readFileSync(offFile));
      copied = true;
    } catch (ex) {
      jxcore.utils.console.warn('Cannot use cached file: ' + ex);
    }

    if (copied) {
      jxtools.console.logPair('Using cached file:', offFile);
      return findJXandUnpack(cb);
    }
  }

  // downloading if cache file is not used
  var url = 'http://az836273.vo.msecnd.net/' + version + '/' + fname;
  if (parsedArgv['use-mirror'])
    url = 'https://raw.githubusercontent.com/jxcore/jxcore-cordova-release/master/' + version + '/' + fname;

  var timeout = 20000;
  if (parsedArgv['timeout'] && parsedArgv['timeout'].isInt)
    timeout = parsedArgv['timeout'].asInt;

  var tries = 3;
  if (parsedArgv['tries'] && parsedArgv['tries'].isInt)
    tries = parsedArgv['tries'].asInt;

  var download = jxtools.http.download(url, fname, {attempts: tries, timeout: timeout});
  download.on('end', function (err) {
    jxtools.console.debugInfo('download end called', err ? 'with error: ' + err : 'without error');
    if (!err) {
      var cfg = config.read();
      var _writeToCache = !cfg.err && cfg.cache === true;
      if (_writeToCache)
        writeToCache(version);

      findJXandUnpack(cb);
    } else {
      cb(err);
    }
  });
};



var checkCachedPackage = function(version) {
  var cfg = config.read();
  if (cfg.err)
    return false;
  if (!cfg.cache)
    return false;
  var cacheDir = null;
  if (cfg.cache === true)
    cacheDir = common.cacheDir;
  else {
    if (cfg.cache.readonly && cfg.cache.path && fs.existsSync(cfg.cache.path))
      cacheDir = cfg.cache.path;
  }

  if (!cacheDir)
    return false;

  var cacheFile = path.join(cacheDir, version, fname);
  return fs.existsSync(cacheFile) ? cacheFile : false;
};

exports.run = function (cb) {

  var parsedArgv = jxcore.utils.argv.parse();

  if (fs.existsSync(localFile)) {
    var stat = fs.statSync(localFile);
    if (stat.size < 1024 * 1024)
      fs.unlinkSync(localFile);
  }

  var force = parsedArgv.force || parsedArgv['force-download'];

  if (fs.existsSync(folder) && !force) {
    jxcore.utils.console.warn('Skipping the download, since folder', dname, 'already exists.');
    jxcore.utils.console.log('If you want to force installing, use --force option.');
    return;
  }


  if (fs.existsSync(localFile) && !force) {
    jxcore.utils.console.warn('Skipping the download, since file', fname, 'already exists.');
    jxcore.utils.console.log('If you want to force downloading, use --force option.');
    findJXandUnpack(cb);
    return;
  }

  var argv3 = process.argv[3];
  if (argv3 && argv3.slice(0, 1) === '-')
    argv3 = null;

  if (argv3) {
    download(argv3, cb);
  } else {
    common.getLatestCordovaVersion(function(err, version) {
      if (err)
        jxcore.utils.console.error(err);
      else {
        jxtools.console.logPair('Latest jxcore-cordova version:', version);
        download(version, cb);
      }
    });
  }

};

