# You Promised Better Than This

Before learning [Promises](http://www.html5rocks.com/en/tutorials/es6/promises/), I decided to benefit from my ignorance for fun.

I wrote a library meant to solve the problem I knew Promises solved.

Of course, this isn't the first time [I looked at that issue](http://espadrine.tumblr.com/post/16233722246/array-processing-in-event-loops). However, that last study was not as in-depth as one might wish. I did encourage a standardization, at the node.js level — it ended up happening at the ECMAScript level, which I must admit is even better.

How much better? The only way for me to tell is to compare their design with the one I would naturally come up with. I know from force of habit that harnessing synchronization in an event-loop-driven, fully asynchronous world, is quite a bit of work. Making a generic library has to be harder still. Where to even start?

I had been playing with Monads, and conceptually, it felt as if those would give the API you need. After all, giving a promise, combining promises: those two fundamental operations sound like return and bind…

Red herring. The result felt as if I tried to fit a giraffe in a car. Driving that car was equally unpleasant. As a result, this is the last time you will read "Monads" in this blog post: "Monads". (If you're interested, you end up needing to put [some lipstick on the pig](https://blog.jcoglan.com/2011/03/11/promises-are-the-monad-of-asynchronous-programming/) to make it usable, making the complexity inside pointless.) There. Done. No more.

I then started thinking about the concept of continuations. For the purpose of simplicity, it was not my intention to make them first-class. However, they would correctly orchestrate the execution flow of the program, cross-event-loop, through Continuation-Passing-Style.

Fundamentally, all I want is to store an action.

    // action: function(value, callback)
    // callback: function(value)
    function Cont(action) { this._action = action; }

The fact that this action takes a value isn't relevant: in JS, a value can be anything. It could be a continuation even. It could be undefined. Since the execution is delayed, where would I execute it? Yes, there is a function for that.

    Cont.prototype.run = function(value, cb) { this._action(value, cb); };

One implicit design choice that I couldn't free myself from is that the user *must* call `cb` in their code (in the action). Failing to do so would stop the execution of the continuation with no warning.

Now I only needed to combine continuations in a sequential flow. I must not have been inspired, I picked a boring name, `then`. It takes an action, returns a continuation for that action. First, do my action. Then, do that action.

    Cont.prototype.then = function(action) {
        var first = this._action;
        return new Cont(function(value, cb) {
            first(value, function(newVal) {
                action(newVal, cb);
            });
        });
    }

 Notice how nothing is actually executed. This creates a flow of code, in which each new callback does the bridge between each action, passing the intended value, but no action is performed, no callback is called, up until the last minute. Besides, you can keep the resulting structure on the side, and call it in different situations.

I need an example to keep you interested. Let's apply the silliest encryption in the world, in the most outrageous way. Let's add timeouts for no reason.

    function wait(f) { setTimeout(f, 100); }

I also want to cut the cipher in lines of the same size.

    function ldiv(s, n) {
        var l = [];
        for (var i = 0; i  {
        wait(() => cb(Array.prototype.map.call(value, i => i.charCodeAt(0))));
    })

We want each integer of the list to be "encrypted". Having no `map` in the async world, this could easily be annoying to write. However, it is pretty easy to implement one once and for all.

    Cont.prototype.map = function(action) {
        var first = this._action;
        return new Cont(function(value, cb) {
            first(value, function(newVal) {
                // newVal is a list. Else, treat it as a singleton.
                if (!(newVal instanceof Array)) { newVal = [newVal]; }
                var count = newVal.length;
                var retList = new Array(count);
                var end = function makeEnd(i) {
                    return function(value) {
                        retList[i] = value;
                        count--;
                        if (count  {
        wait(() => cb(String.fromCharCode(element + 1)));
    })

Each element of the list runs this action, and the continuation is triggered when they all returned their replacement in the array.

Let's wrap up.

    operations = operations.then((value, cb) => cb(value.join(''))
    ).then((value, cb) => cb(ldiv(value, Math.sqrt(value.length)).join('\n')));

Aaaand run.

    operations.run("Hello world and a good day to you all!", alert);

Only when you run the final continuation do you actually execute all the actions.

I am not too worried about errors. They are easy to add to a good design. Look at Go. Look at Rust. In this case, wrapping each action with a try / catch, and putting the error in an additional parameter, is enough. The error cascades with everything else. That way, we can even have a (potentially valid) value, along with an error.

----

Let's look at the Promise library.

My first surprise was how similar it was to my own design. Here is the silly operation we did before, using Promise.

    Promise.resolve("Hello world and a good day to you all!").then(value => {
        return new Promise(resolve => {
            wait(() => resolve(Array.prototype.map.call(value, i => i.charCodeAt(0))));
        });
    }).then(value => {
        return Promise.all(value.map(element => {
            return new Promise(resolve =>
                wait(() => resolve(String.fromCharCode(element + 1))));
        }));
    }).then(value => value.join('')
    ).then(value => ldiv(value, Math.sqrt(value.length)).join('\n')
    ).then(alert);

Sure, it is a bit lengthier, especially the part where I used a `map` (which is surprisingly a use-case they looked at too, with `Promise.all`!) The absence of a callback in each `.then` does not bring anything more, and the Continuations library is essentially equivalent to the Promise library. Or so I thought.

You may notice this `return new Promise` pattern. Indeed, since there are no callbacks, whether you are chaining promises or not depends on whether what you return a Promise or not.

Or so I thought. Actually, it depends on whether you return a *thenable*. What is a thenable? Something with a `.then` method. Which means the values you pass through the pipe can corrupt the pipe itself.

    Promise.resolve({first: ()=>1, then: ()=>5}).then(value => {
        value.first = ()=>2;
        return value;
    }).then(value => alert(JSON.stringify(value)))

Oops, that value is accidentally a thenable. The pipe is prematurely interrupted.

And so I looked at last week's ECMA discussions. Behold, "Why thenables?" was the topic du jour! That issue annoys, but it won't go away… for compatibility reasons. The APIs of the Web were always a bit crufty. 2013 is just another year.

While working ex-cathedra is a fun experience, I wouldn't recommend using my continuations library. The Web doesn't win because it is the best design, it wins because it is the most useful.
