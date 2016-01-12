// Copyright & License details are available under JXCORE_LICENSE file

var console = jxcore.utils.console;

exports.clearLineAbove = function () {
  var cursorUp = "\033[1A";
  var clearLine = "\033[K";
  console.write(cursorUp + clearLine);
};

exports.logPair = function (first, second, color) {
  if (first.slice(-1) !== ':')
    first += ':';

  first = console.setColor(first, "cyan");
  if (second === "Done")
    color = "green";
  if (color)
    second = console.setColor(second, color);
  console.log(first, second);
};


exports.logPairAbove = function (first, second, color) {
  exports.clearLineAbove();
  exports.logPair(first, second, color);
};