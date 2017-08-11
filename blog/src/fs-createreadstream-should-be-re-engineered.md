# `fs.createReadStream` Should Be Re-engineered

I just had a strange WTF moment with node.

To avoid the state of dismay I went in, just remember this:

In node, streams have a `on('error', function(err) {})` method which they run when some errors happen.
Usually, node's default APIs hook a callback to the error, and give you information about this error in the continuation, like so:

    fs.readFile(file, function(err, data) { /* you have access to err here */ });

Unfortunately, `fs.createReadStream` doesn't work like that.
Since there is no listener for the 'error' event on the stream, node crashes loudly, and you cannot try/catch that, because it doesn't happen in the same event loop cycle as the call.

    try {
     var stream = fs.createReadStream('./bogus-file');
    } catch (e) {
     // Not caught!
    }

My advice: if a stream doesn't give you error information, listen to its 'error's.

    stream.on('error', function(err) { ... });

----

I caught the issue as I read the source code of `stream.js`.

    // don't leave dangling pipes when there are errors.
    function onerror(er) {
      cleanup();
      if (this.listeners('error').length === 0) {
        throw er; // Unhandled stream error in pipe.
      }
    }

If nothing listens to the 'error' event, it crashes. Obviously, this kind of construct fails to work with try/catch.

As a result, I wish *all* node API calls used the usual node error handling.

    fs.createReadStream(file, function (err) { ... }, options);

Why wasn't it designed this way originally?

APIs are hard. At least they're not copyrightable now.
