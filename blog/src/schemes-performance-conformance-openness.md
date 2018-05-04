# Schemes: Performance, Conformance, Openness

As [Guile 2.0.10][] just rolled out, I wished to re-acquaint myself with the status of Schemes. I downloaded the new version, compiled it (boy, is it slow to compile), installed it. It is designed as a language to extend existing programs, much like Lua. One goal is obviously to make the interpreter as fast as can be. Ideally, it should be the LuaJIT of Scheme-land.

The other approach used to make Scheme run fast is to compile it. Other projects, such as Chicken Scheme, compile the code to C, and the result tends to have reasonable performance. They do also cut corners, as we'll see.

Let's make one of the most simple non-trivial program. A looped factorial.

    (define (fact n)
      (let ((acc 1))
        (let loop ()
          (set! acc (* acc n))
          (set! n (- n 1))
          (if (zero? n) acc
            (loop)))))

Guile has a number of handy helpers in REPL mode. Notably, `,h` will list all special commands that are available. That includes `,describe`, which gives documentation. For instance, `,describe get-internal-real-time` will tell you that it "returns the number of time units since the interpreter was started". Let's use that.

    (define (time-fact n)
      (let ((t (get-internal-real-time)))
        (fact n)
        (display (- (get-internal-real-time) t))
        (newline)))

The results of running `(time-fact 50000)` in the REPL are not astounding. About 2.62 seconds.

Faced with `(fact 50000)` defined with recursion, Guile threw an error, which is more that can be said of Chicken Scheme, which caused a segmentation fault and died.

Chicken Scheme (or `csi` for short) does not follow the so-called numerical tower by default. For instance, numbers are converted to a floating-point representation when they go beyond the limit. As a result, the same code as before (adapted using its `time` function, which does the same thing as Common Lisp's, that is, it computes the time needed to perform some operation given as an argument) seems very fast: "0.021s CPU time". However, it returns a mere `+inf.0`.

Fortunately, what seems great about Chicken is its wealth of downloadable packages (called "eggs"). The first one you'll want to download is readline, to make the interpreter that much easier to use (it includes autocompletion and bracket highlighting).

    chicken-install readline

(You should [read more here][readline] to see how to set it up for `csi`. Also, to be fair, Guile does one better and has readline support by default, although for some unfathomable reason, you need to input `(use-modules (ice-9 readline) (activate-readline)` to get it.)

You can also install the numerical tower with `chicken-install numbers` (a concept which I find mind-boggling, although certainly not ideal from a language design perspective: having bignums shouldn't be a switch-on feature (especially considering that there is no switch-off), but a data structure choice) and use it with `(use numbers)`. Of course, when using bignums, `csi` is quite slower: 2.86 seconds, with a whole second dedicated to garbage collection. As a side-note, printing the number takes about 20 seconds. All other players do it nearly instantly. Then again, not that much of a surprise: Chicken Scheme is not designed for interpreted situations. It is the worst result of the bunch, although not that far behind Guile.

[readline]: http://wiki.call-cc.org/eggref/4/readline

Petite Chez Scheme (or `petite` for short) is a fairly well optimized interpreter. It has a `(real-time)` procedure that works similarly to Guile's `(get-internal-real-time)`. With it, I could declare it the winner, with an average of 1.90 seconds. What is interesting, however, and shows how optimized it is, is that the recursive version doesn't blow up the stack. I can only assume that it has some curious engineering that detects that it can convert it to a loop. What is amazing is that, although slower than the looped version, the recursive version does far better than Guile's looped version, with an average of 2.22 seconds.

However, `petite` is not open-source. The code is not for you to see. I would love the best Scheme interpreter to be open-source. Because reading software is my bedtime story.

Of course, Common Lisp's SBCL does no compromise, and blows everyone away, with 1.044 seconds of real time (2,296,459,842 processor cycles, it also says, and I wonder with awe how it got that information). And the recursive version is about 1.26 seconds.

Sure, this is a contrived example. It is more of a stress-test of the bignum code. It is also roughly what I expected, and it might actually be representative of the level of optimization involved in each project. I'm sure there'll be a lot more work in the future, and that makes me hopeful.

Here's to Guile becoming the new SBCL!

[Guile 2.0.10]: http://lists.gnu.org/archive/html/info-gnu/2014-03/msg00006.html

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2014-03-18T16:53:00Z",
  "keywords": "lisp" }
</script>
