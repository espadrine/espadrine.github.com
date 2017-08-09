# Language Contradictions

Nobody notices how absurd programming languages are until you try and build a new one.

Cat-and-mouse questions spring everywhere. Here's a few.

Overloading
-----------

Back in the 1960s, overloading meant overhead for compiler writers, so they threw it out of their language. Back then, floating-point implemented in hardware was still a thing! Then came Ada and C++, which featured function overloading. For completeness' sake, C++ added operator overloading. After all, operators behave much like functions, don't they?

Do you want overloading?

This question is still relevant today. Proof is, the Go language [forbids it](http://golang.org/doc/go_faq.html#overloading). How old is Go? It was unveiled in 2008. Bummer.

The thing is, overloading takes a lot of language constructs for granted.
You cannot have overloading without types and functions.
Those are pretty common, but that condemns languages such as Lisp, JavaScript, Python and Lua from ever overloading anything.
Rather, since those languages have weak typing, all functions are systematically overloaded to all existing types.
However, if you *do* want the behaviour of your function to match the type of your parameters, you have two choices:

- You can, C-style, create functions with different names. What a wonderful world!
Now you have two problems. What naming rule to follow?
Lisp has those weird `string-` functions (such as `string-equal`)
which both look ugly and are harder to find, for they stack up real fast.
- You can construct your only function in a `switch` fashion.
You check for the type of the parameter, and you have one code block for each choice.
Of course, this option is unacceptable.
What if you define a brand new type?
You would have to modify the source files of such fundamental functions as `equal`.
No, this is bad.
(Yet such bright examples as [SICP itself](http://mitpress.mit.edu/sicp/full-text/book/book-Z-H-26.html#%_sec_4.1) showcase an `eval` function with a huge type check at its core, hence forbidding the creation of new types.)

At least, the limited possibilities of C makes this choice simple.
You have to create a new name. Yet, you have a single namespace.
You are effectively out of luck.

Look at [those pretty algorithms](http://shootout.alioth.debian.org/u64q/program.php?test=pidigits&lang=gcc&id=4), filled with `mpz_add(tmp2, tmp2, numer)` instead of `+` and `mpz_cmp(tmp2, denom)` instead of `<`.

I once read a blog post that Brendan Eich pointed to. The author was very unhappy with this kind of syntax in Java. One of the commenters told the amazing story of some Wall Street code that contained `BigDecimal total = new BigDecimal( subA.doubleValue() + subB.doubleValue() );`. The + in there could have been the doom of mankind.

While C had an excuse (it was created at a prehistoric time), Go deserves some spite. They argue that…

> Experience with other languages told us that having a variety of methods with the same 
> name but different signatures was occasionally useful but that it could also be 
> confusing and fragile in practice.

Oh, boy. Do they really believe that?

I'll tell you what. This is all nonsense.
Integers are a type. Floating-point numbers are a different type.
You can use the `+` operator with both.
All operators are effectively deeply overloaded, even in C, even in Go.
Is *that* so confusing? If so, take a page from Caml's book. Caml has distinct operators for floating-point arithmetic.

----

Java, on the other hand, argues that overloading is good, because using different names for things that do the exact same thing on slightly different types is silly at best. On the other hand, *operator overloading* is deemed bad.

Right. You can remember that *methods* have multiple meanings, but not *operators*.  
Besides, `x.Add(Number.ONE).Mult(y)` is sooo much prettier.

Java is partially wrong. (I guess I'll surprise some readers with this assertion. What? Java isn't *completely* wrong for once?)

Let me state why Java is wrong first.

Overloading being good has nothing to do with types being very similar (ie, on the same type hierarchy branch).
Overloading should sometimes be applied to types which are miles away from each other.
Overloading allows a namespace mechanism. A function named `draw` can either paint a shape, or remove a certain amount from an account.

On the other hand, Java is right that overloading operators isn't the same.
Until now, I've implicitly assumed that operators behave like functions, but unless you are using Lisp, this simply isn't true.
Nonetheless, they could have allowed overloading, with a word of warning etched beneath in the brightest red: BEWARE OF THE PRECEDENCE!

Precedence
----------

All modern programming languages have built-in types.

All modern programming languages allow users to define their own types.

There should be nothing special between the former and the latter. Yet, there is.

Python has had this issue for quite some time, wherein builtin types did not behave like user-defined classes.
You could not subclass a builtin type, for instance.
They strove to [fix this](http://www.python.org/dev/peps/pep-0253/).
They were right. Why should the user expect builtins to be more important than the code *they* write?
Why should their types be second-class?

Java was strongly overwhelmed by this issue. Wait, my mistake: it still is!
There are those "primitive data types" like `int` and arrays that you cannot subclass. These troublesome builtins were such a thorn under programmers' feet that they wrote [class equivalents](http://download.oracle.com/javase/tutorial/java/data/numberclasses.html) and extraterrestrial things such as `BigDecimal`!
But operators don't work on them.

Operators make built-in types forever special.

I understand the purpose of operators.
They make maths look like maths.
Otherwise, they are completely useless.
But still, they also make builtins more special than your own code! That is *not nice*!

In turn, why did maths do this?
They had a functional notation that was a perfect fit.
It turns out that infix notation is one inch shorter. Yes, one inch is the size of two parentheses and a comma. At least on a blackboard.

The associativity properties of some operators meant that we could chain operations together without caring about bracketing them.

Mathematicians pushed wrist laziness as far as to devise a way to remove even more parentheses. They chained non-associative operations such as addition and multiplication. They invented precedence. May God forgive us.

Does that mean that arithmetic should forever be special?
Lisp proves that there are other ways.
You can make operators behave just like functions.
You can refuse precedence.
You might have every mathematician throwing rocks at you for the rest of your life, though, when they realize that `1 + 2 * 4` is a syntax error. At least it doesn't yield 12.

You can also have faith in your users. You can expect them to use operators for arithmetic only. You can hope that they won't use `+` for string concatenation.

Java, on the other hand, has no faith in its users. Wise decision.
By expecting Java programmers to be dumb, they attracted exactly that portion of the programming world. (Mind you, they attracted wise people, too.)

What I meant to do by writing this article is to make you aware of the fact that your programming tools behave counter-intuitively.

I have yet to see a consistent and productive programming language.
