// Copyright & License details are available under JXCORE_LICENSE file

var cp = require('child_process');
var jx = require('./jx.js');
var consoleEx = require('./console.js');
var path = require('path');
var fs = require('fs');
var util = require('util');

// each command is { name : something", command : "uname -a" }
exports.execMultiple = function (commands, options, cb) {

  if (!util.isArray(commands))
    commands = [commands];

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  if (!options)
    options = {};

  options.maxBuffer = 1e6;

  var ret = {};
  var counter = 0;

  var displayCaption = function(cmd, err) {
    if (cmd && cmd.caption) {
      if (err) {
        consoleEx.clearLineAbove();
        jxcore.utils.console.error(cmd.caption);
        if (cmd.postErrorMessage)
          jxcore.utils.console.log(cmd.postErrorMessage);
      } else {
        jxcore.utils.console.info(cmd.caption);
      }
    }
  };

  var next = function () {
    var _cmd = commands.shift();

    if (!_cmd)
      return cb(ret);

    counter++;
    if (!_cmd.name)
      _cmd.name = counter;

    displayCaption(_cmd);
    var _options = JSON.parse(JSON.stringify(options));

    if (_cmd.cwd)
      _options.cwd = _cmd.cwd;
    if (_cmd.timeout)
      _options.timeout = _cmd.timeout;
    if (!_cmd.skipError && _options.skipError)
      _cmd.skipError = _options.skipError;

    if (typeof _cmd === 'function') {
      _cmd();
      process.nextTick(next);
      return;
    }

    if (typeof _cmd.command === 'function') {
      try {
        _cmd.command();
        ret[_cmd.name] = 'OK';
      } catch (ex) {
        ret[_cmd.name] = {
          cmd: _cmd.command,
          err: ex + ''
        };

        displayCaption(_cmd, ex);
      }
      process.nextTick(next);
      return;
    }

    cp.exec(_cmd.command, _options, function (error, stdout, stderr) {
      if (!error) {
        ret[_cmd.name] = stdout.toString().trim();
      } else {
        ret[_cmd.name] = {
          cmd: _cmd.command,
          err: error.toString().trim(),
          stdout: stdout,
          stderr: stderr,
          cwd: process.cwd()
        };
        ret.errors = true;
        displayCaption(_cmd, error);
        if (!_cmd.skipError) {
          // exit on first error
          ret.errors = 'Command failed: `' + _cmd.command + '`:\n' + error;
          return cb(ret);
        }
      }
      process.nextTick(next);
    });
  };

  next();
};


exports.getRmdirCommand = function (fullDir) {
  var cmd = "rm -rf ";
  if (process.platform === 'win32') cmd = "rmdir /s /q ";
  if (process.platform === 'android') cmd = "rm -r "; // no -f allowed
  return cmd + fullDir;
};

exports.rmdirSync = function (fullDir) {

  if (jx.onlyForJXcore('jxtools.fs.rmdirSync()'))
    return;

  fullDir = path.normalize(fullDir);
  if (!fs.existsSync(fullDir))
    return;

  var cmd = exports.getRmdirCommand(fullDir);
  jxcore.utils.cmdSync(cmd);
};


// removes non-empty folder
exports.rmdir = function (fullDir, cb) {

  fullDir = path.normalize(fullDir);
  if (!fs.existsSync(fullDir))
    return;

  var cmd = exports.getRmdirCommand(fullDir);
  cp.exec(cmd, function (error, stdout, stderr) {
    cb(error);
  });
};


/**
 * If src is a file, than copies it to dest.
 * If src is a folder, than copies it to dest recursively.
 * @param src
 * @param dest
 */
exports.copySync = function (src, dest) {

  src = path.normalize(src);
  dest = path.normalize(dest);
  if (!fs.existsSync(src)) {
    return;
  }

  var stats = fs.statSync(src);
  if (stats.isFile()) {
    fs.writeFileSync(dest, fs.readFileSync(src));
    return;
  }

  if (stats.isDirectory()) {
    var files = fs.readdirSync(src);

    if (!files.length) {
      return;
    }

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }

    for (var a in files) {
      if (!files.hasOwnProperty(a))
        continue;
      var srcFile = src + path.sep + files[a];
      var dstFile = dest + path.sep + files[a];
      var stats = fs.statSync(srcFile);

      if (stats.isDirectory()) {
        exports.copySync(srcFile, dstFile);
      } else {
        fs.writeFileSync(dstFile, fs.readFileSync(srcFile));
      }
    }
  }
};


/**
 * Copies binary file and sets chmod 755
 * @param src
 * @param dst
 * @return {*}
 */
exports.copyExecutableSync = function (src, dst) {
  try {
    var dir = path.dirname(dst);
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir);

    fs.writeFileSync(dst, fs.readFileSync(src));
  } catch (ex) {
    return {err: "Cannot copy file from '" + src + "' to '" + dst + "'.\n" + ex};
  }

  if (process.platform !== "win32") {
    try {
      fs.chmodSync(dst, 0755);
    } catch (ex) {
      return {err: "Cannot chmod -755 copied jx: " + dst + ".\n" + ex};
    }
  }

  return true;
};

/**
 * Moves binary file and sets chmod 755
 * @param src
 * @param dst
 * @return {*}
 */
exports.moveExecutableSync = function (src, dst) {

  var ret = exports.copyExecutableSync(src, dst);
  if (ret.err)
    return ret;

  try {
    fs.unlinkSync(src);
  } catch (ex) {
    return {err: "Cannot remove: " + src + ".\n" + ex};
  }

  return true;
};
