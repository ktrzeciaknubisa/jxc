# jxtools

JXcore Tools

```js
var jxtools = require('jxtools');
```

#### tools/zip.js

```js
var unzipper = new jxtools.zip.Unzipper();

unzipper.on('end', function (err) {
    if (err)
    console.error(err);
});

unzipper.unzip(file, input.localDir);
```

#### tools/http.js

##### Downloading JXcore

* downloadJXcore([version][, engine][, arch], cb)

```js
jxtools.http.downloadJXcore('0.3.0.7', 'sm', function(err, jxfile) {
  console.log(err ? "Err: " + err : "OK: " + jxfile);
});
```
