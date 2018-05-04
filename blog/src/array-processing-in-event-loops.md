# Array Processing In Event Loops

Much has been said about the use of event loops in JavaScript, especially because of their extensive use in node.js. Much has been said about how coroutines could help avoid the pyramid of doom that the event loop constructs causes.

    f(function(g) {
      g(function(h) {
        h(function() {
          ...
        });
      });
    });

Dave Herman [argues](http://calculist.org/blog/2011/12/14/why-coroutines-wont-work-on-the-web/) that coroutines cannot work in the web because it makes any function call a potential preemption point that might use multiple event loop cycles before completion. That's the whole spirit (and danger) of `yield` in coroutines. This old Racket hacker would rather have `call/cc` (call with current continuation), a Scheme mechanism that allows to save the completion of a function into some sort of function variable that you can then run whenever you want. For the next version of the ECMAScript standard, however, he settles for generators, which are much safer than coroutines, while providing similar (albeit not nearly as powerful) constructs. The basic difference is that a generator cannot suspend the function that called it: in this respect, it feels a lot like a stateful function.

Before that, Vyacheslav Egorov [published a rant](https://plus.google.com/111090511249453178320/posts/LB6LAk3fPUy) in which he points out that, while indeed coroutines do not make it obvious that they don't necessarily run to completion, (since they are syntactically the same as functions), the equivalent, "spaghetti code", node.js construct for non-blocking I/O raises a similar concern. Callbacks can either be run in the same event loop cycle as the function that is calling them, or they can be run several spins away. Shared state between the closure and the function it is nested in is hence insecure. It can be easily manipulated wrong.

One such case that I found while using node.js' APIs is while processing arrays.

Had the solution been too obvious to need any help, or too specific to be generally corrected, I wouldn't have raised my voice. The thing is, I believe it is time to have constructs such as the one I will present, either in node.js' library, or directly in ECMAScript.

[Small note: if you'd rather read highlighted code than a whole article, [here](https://gist.github.com/1640136) is a fine place to be.]

For the purpose of the argument, let's first create a function that, just like those in node.js, takes a function callback as an argument, but only runs it several event loop cycles later.

    function differedFactorial(n /* Number */, cb /* Function */) {
      if (n < 0)  cb(new Error('Complex infinity'));
      setTimeout(function() {
        var result = 1;
        for (; n > 1; n--) {
          result = result * n;
        }
        cb(result);
      }, 300);
    }

When you know you have such a function, you must be careful how you use it.

Suppose you have an array of numbers. You want them processed by our `differedFactorial` function. You may think that you can map the array at first. How wrong.

    var a = [2, 4, 6, 9];
    console.log(a.map(function(e) {
      var result;
      differedFactorial(e, function(res) {
        result = res;
      });
      return result;
    }));

The result you get is an array of four `undefined` values.

Why is that?

The basic issue is that you run through the `map` function. When the `differedFactorial` function is hit, its callback is not run. As a result, what we return is a value that has not yet been assigned, `undefined`.

How can we make it work?

We can construct a new map function that accommodates the callback system. Let's try a first draft of such a function.

    Array.prototype.asyncMap = function(f /* Function */, cb /* Function */) {
      var l = [], len = this.length;
      for (var i = 0; i < len; i++) {
        f(this[i], i, this, function(e) {
          l.push(e);
          if (l.length === len) {
            cb(l);
          }
        });
      }
    };

    a.asyncMap(function(e, i /* Number */, a /* Array */, cb /* Function */) {
      differedFactorial(e, function(res) { cb(res); });
    }, function(result) {
      console.log(result);
    });

This seems to work, at first sight. Inside the array that we construct, the length property tells us when to return the result.

However, an important contract that we make with the user is that, in all cases, he must call asyncMap’s callback once for each element that is processed by differedFactorial. Otherwise, we will never return anything, and there will be no warning, exception or whatsoever.

But even in this implementation, there remains an important issue. In order to make this issue obvious, let’s construct a derived differedFactorial.

    function differedFactorial(n /* Number */, cb /* Function */) {
      if (n < 0)  cb(new Error('Complex infinity'));
      setTimeout(function() {
        var result = 1;
        for (; n > 1; n--) {
          result = result * n;
        }
        cb(null, result);   // No errors, result is given.
      }, 150 + Math.abs(300 * Math.random()));
    }


This time, the dummy non-blocking cross-cycle function probably won't return values in order. Indeed, it runs the callback after a random amount of time.

As a result, the order of the elements in the returned list is not that of the elements in the list we passed in.

The following function preserves order. An interesting side-effect is that, while it does allocate more than the previous implementation (because of that `processing` variable), it takes just as long to compute.

    Array.prototype.asyncOrderedmap = function(f /* Function */,
                                               cb /* Function */) {
      var processing = 0,
          l = new Array(this.length),
          len = this.length;
      for (var i = 0; i < len; i++) {
        f(this[i], i, this, function(e, idx) {
          l[idx] = e;
          processing++;
          if (processing === len) {
            cb(l);
          }
        });
      }
    };

An additional requirement on the user is that, whenever he sends a processed value from the array, he must also indicate its index.

    a.asyncOrderedMap(function(e,
                               i /* Number */,
                               a /* Array */,
                               cb /* Function */) {
      // The callback has one more argument, the index.
      differedFactorial(e, function(res) { cb(res, i); });
    }, function(result) {
      console.log('asyncOrderedMap: %s', result);
    });

This algorithm is not trivial. I used to write it directly, with no function to help me. It seemed only too obvious. But I was wrong, because I assumed too much.

For instance, I had to track down a very strange bug that only occurred in certain conditions. That bug was present in real code, but as soon as I tried to test the segment of code that I knew was buggy, then that particular piece of code worked perfectly.

The issue was that the length of the array varied whilst I was processing it. Indeed, since processing took more than one event loop cycle, another piece of code was sometimes adding new elements to it. The only thing that made it break is that I only stopped processing the array when the length of the new array matched the planned length that I had calculated at the beginning. Of course, once one element had been added to the original array, the new array would never reach the length of the original array, since it was topped by the length initially calculated.

Had I used `asyncOrderedMap`, it would have spared me a lot of debugging time.

My point is that the Event-Loop model has bad parts, but they can easily be overcome by completing the standard library.

Beginners in node.js struggle with those bad parts. They wouldn’t if an asynchronous library was added to the built-in libraries in node.js.

There is a such library, amongst the npm modules, that I have found quite good. It frees the user from one of the contracts of asyncOrderedMap: we don’t have to give the index of the current element to the callback. They achieve that by adding state to the list we give them.

Try it today.

Install it with:

    npm install async

You can check that it solves the problem presented here quite fine:

    var async = require('async');

    function differedFactorial(n /* Number */, cb /* Function */) {
      if (n < 0)  cb(new Error('Complex infinity'));
      setTimeout(function() {
        var result = 1;
        for (; n > 1; n--) {
          result = result * n;
        }
        cb(null, result);   // No errors, result is given.
      }, 150 + Math.abs(300 * Math.random()));
    }
    
    var a = [2, 4, 6, 9];
    async.map(a, differedFactorial, function(err, res) {
      console.log(res);
    });

Moreover:

- if you are part of the core development team at `node.js`, include it.
- if you are not, beg them to do so!

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2012-01-21T18:29:00Z",
  "keywords": "" }
</script>
