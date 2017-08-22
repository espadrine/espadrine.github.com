# Don’t be eval()

[TLDR: <https://github.com/espadrine/localeval>]

We JS programmers know how evil `eval()` is. An attempt at copying the fancy concept of Lisp's metacircular evaluator, it takes a string instead of Lisp's homoiconic quoted syntax tree. Beyond that, unlike Scheme (which allows to specify your own environment), it evaluates the code in the current lexical environment. Consequently, it can mess with all variable bindings in scope, and will leak to the outside world all variables it defines.

I sometimes wondered how I would go about making a fast, safe JS evaluator without relying on something as complicated as Brendan Eich's implementation of JS in JS, [Narcissus](https://github.com/mozilla/narcissus).
I have [figured it out](https://github.com/espadrine/localeval) recently.
Let me tell you how.

First of all, unlike what many believe, `eval()` is not the only built-in JS function that takes JS code as a string for evaluation. The `Function()` constructor does too. Its last argument contains the code for the body of the function, as a string, and the arguments before that one contain the names of the function's parameters.

    var f = Function('a', 'b', 'return a * b');
    console.log(f(6, 7));  // 42

Just like `eval()`, it has destructive access to the surrounding variables.

    var n = 0;
    var f = Function('a', 'n++; return a + n');
    console.log([f(3), f(3)]);  // 3, 4
    console.log(n);  // 2

Having the ability to create a new function means that we can carefully *construct exactly the environment* that we wish to target, kind of like a green screen in the background, on which you may clip any sandbox (that is, any set of symbol bindings) and run your code on top of it.

Beyond that, it gives you the ability to *shadow access to outside global variables*. Yes, you may literally, with the power of ES5, navigate the full prototype chain of the global object (which you can access with `this` on a non-strict-mode function) and aggregate all the symbols in a huge string that looks like `var foo, bar, …;`!

    var reset = 'var ';
    var obj = this;
    var globals;
    while (obj !== null) {
      globals = Object.getOwnPropertyNames(obj);
      for (var i = 0; i </https:>
