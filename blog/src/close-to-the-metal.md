# Close to the metal

What a strange expression. It is very much used by Go (the language) advocates (and by its authors; both titles overlap).

My understanding of "**close to the metal**" was that I knew at any point of the program when the memory I manipulate is on the stack or in the heap. As a result, I can reason about the memory layout and the efficiency of the data structures I create.

In fact, just like many fancy terms that I hear about programming languages, such as "Write once, run everywhere", "Native", "App-scale", and so on, this is just another expression of which I have yet to find the meaning.

A couple of days ago, I came across [the following talk](http://talks.golang.org/2012/splash.article). One sentence really stood out in my head: "it is legal (encouraged even) to take the address of a stack variable".

Obviously, in most languages whose compiler I would call "close to the metal", taking the address of a stack variable is a very common operation. However, those languages have the habit of making the program crash if you are not careful about where data is freed, and what pointers point to. Yet, one of Go's redeeming qualities is to guarantee that pointer manipulation is safe (most of the time). What does it do to prevent the worst from happening?

I wrote the following program with the intention of understanding how the compiler avoided a crash under the hood:

    package main
    
    import "fmt"
    
    func f() *int {
      i := 5
      pi := &amp;i
      *pi ++
      fmt.Println("i = ", i)
      fmt.Println("pi = ", *pi)
      return pi
    }
    
    func main() {
      pi := f()
      fmt.Println("result = ", *pi)
    }

I return a pointer that points to what I consider to be a stack variable, but really is simply a local variable. Then I dereference that pointer. If this was C, the stack variable would get destroyed upon returning from the function, and therefore the pointer would point to a forbidden address in memory. That should cause a crash.

You probably guessed at that point that this program doesn't crash. It returns the correct answer.
Here goes the start of the generated assembly code for the function `f`, obtained with `go tool 6g -S program.go`:

    0000 (program.go:5) TEXT    f+0(SB),$152-8
    0001 (program.go:6) MOVQ    $type.int+0(SB),(SP)
    0002 (program.go:6) CALL    ,runtime.new+0(SB)
    0003 (program.go:6) MOVQ    8(SP),CX
    0004 (program.go:6) MOVL    $5,(CX)
    0005 (program.go:7) MOVQ    CX,&amp;i+-72(SP)
    0006 (program.go:8) MOVL    $1,AX
    0007 (program.go:8) MOVQ    CX,pi+-112(SP)
    0008 (program.go:8) MOVL    (CX),BP
    0009 (program.go:8) ADDL    AX,BP
    0010 (program.go:8) MOVL    BP,(CX)

The local variable `i` corresponds to the CX register. In it is placed the address of a freshly allocated heap slot the size of an `int`. We put 5 in the slot it points to, then we put CX to a slot on the stack which we say is the address of `i` (`&amp;i+-72(SP)`), so that `i` is never conceptually on the stack.

Obviously, I then tried to make the function return `i` (the integer), instead of `pi` (the pointer to an integer). Then, the assembly clearly allocated memory for `i` on the stack, and `pi` did hold the address of a stack variable. In other words, the compiler tries to put the variable on the stack, and if that can hurt memory safety, it puts it on the heap.

Consequence: in Go, knowing whether a variable is on the stack is non-trivial. The very same variable declaration can either occur on the stack or on the heap.

I find this design great, but it does make me wonder what the authors mean by saying that the language is "close to the metal". This being said, knowing where the variable is stored doesn't matter, as long as we know the compiler does its best, and as long as we have tools to let us know where we can optimize, and what we can optimize.

Which brings me to **optimizing JavaScript**. I have had an interesting discussion last summer with the great Benjamin Peterson, who did outstanding work on Firefox' JS engine. We were talking about the availability (or lack thereof) of tail-call optimization in interpreters and compilers.
His comment on implementing it was that the programmer should be able to state his/her intention, in order to get feedback of the following kind: "We're sorry, we were unable to perform tail-call optimization because…"

I feel like programmers should be able to know whenever an optimization they hope to achieve doesn't get performed. In Go, the case of knowing whether the variable is on the stack is a contrived example. In JavaScript, where the same kinds of tricks as discussed above are found everywhere, knowing where a function gets deoptimized because an argument was assumed to be an integer, and the function suddenly gets called with a string, is a valuable piece of information. Why was a string passed in? It might even be a bug.

In EcmaScript, there is a valid statement, [`debugger`](http://es5.github.com/#x12.15), which probably does what you think it does. Nothing, unless you're debugging. Adding syntax to help programmers is a natural thing to do. There needs to be syntax to warn the programmer when an optimization he/she hoped for doesn't get triggered, without having him/her look at bytecode or assembly code.

There are some attempts in the wild. V8 comes with a switch, `--trace-deopt`, which will give you all information about deoptimizations in a format of dubious legibility. Firefox has some primitives that give information about things that could have been optimized. The great Brian Hackett even made an [addon](https://addons.mozilla.org/en-US/firefox/addon/jit-inspector/) which highlights in shades of red pieces of code that couldn't get boosted by the JIT engine. However, the information it gives is quite cryptic; it is unclear to mere mortals how they should change their code to get the boost. Also, it is quite hard to navigate, since it tracks all JS code throughout the browser. Programmers want to know how *their code* does, and they don't want to jump through hoops to get that information. However, the idea of painting your code in red is one step closer to being told, "Hey, this piece of code should be rewritten this way".

On the standards front, the closest thing you get is something they call [Guards](http://wiki.ecmascript.org/doku.php?id=strawman:guards). This strawman amounts to type annotations that you can put anywhere you have a binding. However, it specifies that the code should throw if the type we specify for a variable isn't that of the data we feed it. That isn't quite the same thing as having a way to check for an optimization at all. Yet, the syntax itself would be valuable to request information about a certain class of bailouts.

There is a lot yet to do to help programmers write code closer to the metal. What I do know is that current tools are only a glimpse of what we could have. The "Profiles" tab in WebKit's DevTools is notoriously seldom used, compared to any other tab. The information it gives is a struggle to work with. [Flame graphs](http://www.cs.brown.edu/~dap/agg-flamegraph.svg) are the beginning of an answer. The question being not "where is my code slow" but "what can I do to make it faster", making tools that give you clues on how to improve that [jsperf](http://jsperf.com/) score is an art that is yet to harness.
