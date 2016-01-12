// Copyright & License details are available under JXCORE_LICENSE file

var fs = require('fs');
var path = require('path');

if (typeof jxcore === 'undefined')
  jxcore = {utils: require('./lib/jx/_jx_utils')};

var jx = require('./lib/tools/jx.js');


for (var o in jx) {
  if (jx.hasOwnProperty(o))
    exports[o] = jx[o];
}

exports.console = require('./lib/tools/console');
exports.fs = require('./lib/tools/fs');
exports.http = require('./lib/tools/http');
exports.zip = require('./lib/tools/zip');



