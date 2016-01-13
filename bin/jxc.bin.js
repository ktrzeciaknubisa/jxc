#!/usr/bin/env node

// Copyright & License details are available under JXCORE_LICENSE file

var jxtools = require('jxtools');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var common = require('../lib/common.js');


if (process.argv.length <= 2) {
  console.log("Too little arguments.");
  process.exit();
}

var argv2 = process.argv[2].replace("--", "");

var parsedArgv = jxcore.utils.argv.parse();
if (parsedArgv.h || parsedArgv.help) {
  jxcore.utils.console.log(common.getHelp(argv2));
  return;
}

var files = fs.readdirSync(path.join(__dirname,  '../lib/commands'));
if (files.indexOf(argv2 + '.js') === -1) {
  jxcore.utils.console.error('Unknown command', argv2);
  process.exit(-1);
}

var mod = require(path.join('../lib/commands', argv2 + '.js'));

var _run = function() {
  mod.run(function(err, txt) {
    if (err)
      jxcore.utils.console.error(err);
    if (txt)
      jxcore.utils.console.log(txt);

    if (err)
      process.exit(1);
  });
};


if (mod.dontCheckCordova) {
  _run();
} else {
  cp.exec('cordova info', function (error, stdout, stderr) {
    if (error) {
      jxcore.utils.console.error('The `cordova info` test failed:', stderr.toString().trim());
      jxcore.utils.console.log(stderr.toString().trim());
      return;
    }

    _run()
  });
}


