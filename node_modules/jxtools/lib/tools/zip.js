// Copyright & License details are available under JXCORE_LICENSE file

var fs = require("fs");
var path = require("path");
var AdmZip = require("adm-zip");
var events = require('events');

var consoleEx = require('./console.js');

var unzip = function (options) {

  if (!options)
    options = {};

  var _this = this;
  var eventEmitter = new events.EventEmitter();
  this.on = function (event, listener) {
    eventEmitter.on(event, listener);
  };
  var silent = options.silent || false;

  this.unzip = function (zipFile, outputDir) {

    if (!fs.existsSync(zipFile)) {
      var msg = "Cannot unzip. File does not exist: " + zipFile;
      if (!silent)
        jxcore.utils.console.error(msg);

      eventEmitter.emit('end', msg);
      return;
    }

    if (!fs.existsSync(outputDir))
      fs.mkdirSync(outputDir);

    var zip = new AdmZip(zipFile);
    var zipEntries = zip.getEntries();

    // needed one empty line
    if (!silent)
      console.log("");

    zipEntries.forEach(function (zipEntry) {
      if (!silent)
        consoleEx.logPairAbove('Unzipping', zipEntry.name);

      eventEmitter.emit('progress', zipEntry.name);
      zip.extractEntryTo(zipEntry, outputDir, /*maintainEntryPath*/false, /*overwrite*/true);
    });

    if (!silent)
      consoleEx.logPairAbove('Unzipping', 'Done');

    eventEmitter.emit('end');
  };


  this.unzipFile = function (zipFile, fileEntry, outputDir) {

    if (!fs.existsSync(zipFile)) {
      var msg = "Cannot unzip. File does not exist: " + zipFile;
      if (!silent)
        jxcore.utils.console.error(msg);

      eventEmitter.emit('end', msg);
      return;
    }


    var zip = new AdmZip(zipFile);

    // needed one empty line
    if (!silent)
      console.log("");

    try {
      zip.extractEntryTo(fileEntry, outputDir, false, true);
    } catch (ex) {
      eventEmitter.emit('end', 'Cannot unzip file ' + fileEntry + ' from the archive ' + zipFile + ': ' + ex);
      return;
    }

    if (!silent)
      consoleEx.logPairAbove('Unzipping', 'Done');

    eventEmitter.emit('end');
  };

};


exports.Unzipper = unzip;