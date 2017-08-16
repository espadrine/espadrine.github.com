# Making the JS console intuitive

The most familiar tool that DevTools put in your belt is a JavaScript console.
And you know how it should work, right? Just like that Firebug console we had for so many years.

Except that most JS consoles actually suffer from what Joel Spolsky called [leaky abstraction](http://www.joelonsoftware.com/articles/LeakyAbstractions.html). Let's go through the edge-cases.

**When I press ENTER**

You may wonder, what happens behind the covers, when I press Enter in the console?

Let's look at *Firefox*. We have an API for [sandboxes](https://developer.mozilla.org/en-US/docs/Components.utils.Sandbox) in the browser. A sandbox has its own global object, but it is linked to what we call a compartment. For simplicity's sake, let's consider that a compartment is a web page. When we evaluate code in the sandbox, it acts just as if the page was running it, except that the page cannot access (and run code in) the sandbox itself.

However, the duplication of global objects has undesirable side-effects.

    document instanceof Object  // false, should be true.
    var foo = 5;
    window.foo  // undefined, should be 5.

The sandbox has a distinct global object, so `var foo = 5` adds a `foo` property to its global object. However, `window` is the web page's global object, which does not see `foo`. Similarly, `document` belongs to the web page, while `Object` is attached to the sandbox.

You may think this is bad. Let me show you what *Google Chrome* [does](https://github.com/WebKit/webkit/blob/5c21b924213ce72bb53af15baca6ae31ed9542b0/Source/WebCore/inspector/InjectedScript.cpp#L70).

What is the simplest solution you can come up with? The web page's global object already has a function to run arbitrary JavaScript. `eval()`, right? But this is a security hazard. Copy and paste this URL in your omnibar:

    data:text/html,<title></title><script>window.eval = function (e) { console.log('sending ' + e + ' to a malicious website!'); };</script>

(Don't worry, it isn't really malicious). Open the JS console, type something in.

Why do you get everything you enter sent to a malicious website (not really)? Because the web page redefines `eval()` to be whatever they want, along their sinister agenda.

(This has been [filed](https://bugs.webkit.org/show_bug.cgi?id=96559), and it has been fixed in Chromium.)

I have to say, *Opera*'s implementation seems spotless. None of the issues raised above are to be found. They [call](https://github.com/operasoftware/dragonfly/blob/master/src/repl/repl_service.js#L419) an `Eval` binding which is documented [here](http://operasoftware.github.com/scope-interface/EcmascriptDebugger.6.14.html#Eval), and which takes care of all possibilities (running the code in the stack frame when the debugger is on a breakpoint, etc.) without getting disturbed if the web page modifies the `eval()` function. Magic!

**Special cases ($0 and friends)**

The set of all special variables and functions you get in the JS console is what Firebug calls the Command Line API.
It has [some kind of spec](http://getfirebug.com/wiki/index.php/Command_Line_API). It is a plain simple documentation of their behaviour, written in Fall 2009. When Google Chrome started their own DevTools, they copied a lot of the behaviour that Firebug had, and the same goes for Opera Dragonfly. Thus far, that spec has been very uncontroversial.

Only recently did Paul Irish suggest changing `$()` from the old `document.getElementById` (inherited from prototype.js) [to](https://docs.google.com/spreadsheet/viewform?formkey=dHA5RjFzbF9tcElCa3VXYm13ZTctdkE6MQ) [a](https://bugzilla.mozilla.org/show_bug.cgi?id=778732) [more](https://bugs.webkit.org/show_bug.cgi?id=92648) [intuitive](https://plus.google.com/113127438179392830442/posts/Bo1zdF4X9mp) (jQuery-inspired) `document.querySelector`. Everybody liked the idea, it got re-implemented everywhere (I contributed the Opera Dragonfly [change](https://github.com/operasoftware/dragonfly/pull/53)).

*Opera* calls them [Host commands](https://github.com/operasoftware/dragonfly/blob/cf46806f747067825c66142a6869c54b36f17d68/src/repl/commandtransformer.js#L237). As you can tell from looking at their code, they replace the matched token that their parser gives them with a string of JS code.
For example, `$` is first parsed as a token, which is replaced on the fly with `"(typeof $ == 'function' &amp;&amp; $ || function(e) { return document.getElementById(e); })"`. Then, all tokens get concatenated, and evaluated. The simplest monkey-patching can do the trick.

(They even take care of recursive commands, by re-flowing the post-processed code through their tokenizer, although I don't believe they actually use recursive host commands!)

While Opera's host commands operate just like pre-processor macros, *Firefox*, on the other hand, injects [all those special functions](http://hg.mozilla.org/integration/fx-team/file/5650196a8c7d/browser/devtools/webconsole/HUDService-content.js#l518) in [the sandbox' global object](http://hg.mozilla.org/integration/fx-team/file/5650196a8c7d/browser/devtools/webconsole/HUDService-content.js#l1005).

Finally, *WebKit* has the most infamous solution of all. You can easily notice that, upon entering the following code in the console, as you may have noticed while trying the "malicious" web page:

    (function() { debugger; }())

… a new script called `(program)` will pop up in the debugger and show [the following content](https://github.com/WebKit/webkit/blob/5c21b924213ce72bb53af15baca6ae31ed9542b0/Source/WebCore/inspector/InjectedScriptSource.js#L448):

    with ((window &amp;&amp; window.console &amp;&amp; window.console._commandLineAPI) || {}) {
    (function() { debugger; }())
    }

You can probably guess what `window.console._commandLineAPI` contains. It's an object that maps identifiers like `$` and `$$` to defined functions. Evaluating `console._commandLineAPI.$.toString()` yields "function () { [native code] }": yep, all those functions are native, all written in C++.

We don't really see a performance impact from the use of the with statement, but injecting all window variables, console variables, and the command line API, using this frown-upon construct, feels wrong in some subconscious way.

*Firebug* [defines real functions](https://github.com/firebug/firebug/blob/af1d74102de2cd2f2f9202f18d1d4c02439aa16a/extension/content/firebug/console/commandLine.js#L1050), and then tries to do [the right thing](https://github.com/firebug/firebug/blob/af1d74102de2cd2f2f9202f18d1d4c02439aa16a/extension/content/firebug/console/commandLine.js#L274), inserting the API [into the JS frame](https://github.com/firebug/firebug/blob/af1d74102de2cd2f2f9202f18d1d4c02439aa16a/extension/content/firebug/console/commandLine.js#L274) if available, but [it ends up not doing anything with it](https://github.com/firebug/firebug/blob/master/extension/content/firebug/js/debugger.js#L84), which explains why you don't get to use `$` and friends in the console, while on a breakpoint.

The backup plan [will sound familiar](https://github.com/firebug/firebug/blob/af1d74102de2cd2f2f9202f18d1d4c02439aa16a/extension/content/firebug/console/commandLine.js#L180).

    expr = "with(_FirebugCommandLine){\n" + expr + "\n};";


**Future changes**

In order to erase the issues I talk about in Firefox' WebConsole, we are working on a tighter integration with our Debugger. You can read all about it on [this lengthy thread](https://bugzilla.mozilla.org/show_bug.cgi?id=774753). The basic idea is, instead of a sandbox, use the debugger to run code dynamically, while adding bindings (the command line API) that are not accessible from the web page. Shout out to Jim Blandy for adding [this functionality](https://bugzilla.mozilla.org/show_bug.cgi?id=785174) to the Debugger recently.

Obviously, there is more work to be done. We are careful about not making this change cause performance regressions, or security problems. No rush, but we are on the right path!

**Wrapping up**

We arrive at the end of our journey. All in all, tool developers have proven very ingenious, twisting every part of the JS language to meld it to their needs. However, the resulting disparate toolboxes can have rough, incompatible edges (think Opera's host commands, `$` and `$$` for example, which cannot be used as function references).

Yet, this is one of the most functional cross-browser API that I ever saw. The magic happens by discussing your implementation with fellow tool hackers. Thank you Internet!
