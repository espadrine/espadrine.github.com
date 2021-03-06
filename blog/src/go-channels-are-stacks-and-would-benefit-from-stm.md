# Go Channels Are Stacks And Would Benefit From STM

I was experimenting with **Go channels**, the other day,
and for some reason the following code surprised me.

    package main
    
    import "fmt"
    
    var n = 0
    
    func send(c chan int) {
        for i := 0; i < 3; i++ {
            c <- n
            n++
        }
    }

    func get(n int, c chan int) {
        for i := 0; i < 3; i++ {
            fmt.Println(n, "get", <-c)
        }
    }

    func main() {
        c := make(chan int)
        go send(c)
        go send(c)

        go get(1, c)
        get(2, c)
    }

Indeed, I expected channels to work like a FIFO, where in fact they work like a stack.

As a result, the output was the following:

    1 get 1
    1 get 1
    2 get 0
    1 get 2
    2 get 4
    2 get 5

Something to note is that this output is predictable, and depends only on the number of cores available on the machine it runs on. I’ll discuss this more in length later.

## What Happened There?

If channels worked like FIFO, each channel would have an entry point and an end point. Sending an element to the channel would put something to the entry point, and that element would be obtained, in the same order, at the end point.

However, as can be noticed from the output, we receive the 1 before the 0. The reason for that is, well, that Go’s duplex channels are stacks. Senders and receivers use the same end point to put data in and to get data out.

* The `send` function puts 0 in the channel,
* The `send` function puts the first 1 in the channel,
* At this point, the first `send` goroutine hasn’t yet incremented n, while the other `send` goroutine adds n (which is still 1) to the channel’s stack.
* Then the first get goroutine starts reading the channel. It gets two 1s.
* The second get goroutine then reads the channel, and gets the 0 that was first sent to the channel.
* The rest of the output is pretty straightforward.

## Locks Are Bad

Remember that “double 1, but no 3” issue we saw? How would we solve that?

The issue here is: there is a variable shared between two goroutines. That variable acts like a structure that only stays coherent if the following operation is atomic:

1. send the variable’s value to the channel,
2. increment the variable.
Of course, that isn’t atomic, and this is the reason why we get issues.

Of course, this issue is an elementary concurrency problem which has been solved hundreds and hundreds of times.

The issue, to me, is that the advised solution (that is, the solution advocated by the Go authors), is to use locks. Locks have great known issues. First of all, locks must be applied in the same order when applying them and removing them; but that is the least of locks’ problem. Unfortunately, the fact that a piece of code uses locks correctly doesn’t ensure that integrating this piece of code with another won’t just run into a deadlock.

The famed example is that of the philosopher’s dinner.

Imagine a table with as many plates as there are philosophers, and one fork between each plate. Each philosopher works like a goroutine that needs to access the left fork and the right fork simultaneously, if he wants to eat. Each fork is a shared variable. Place a lock on it: each philosopher will lock the fork on their right, then try to lock the fork on their left, and you’ll get a deadlock.

The solution to this problem is to have a “conductor” which gives permission to take a fork. The conductor has access to more information than any of the philosophers, and if he sees that a philosopher taking a fork will lead to a deadlock, he can refuse him the fork.

That mechanism is what we call a semaphore. Unfortunately, a very simple modification to the problem makes a deadlock very likely. For instance, if another philosopher joins the party without the conductor’s knowledge, you’re likely to run into troubles.

Linux has slowly tried to switch from locks to a synchronization mechanism called RCU (Read-Copy-Update), which works like a lock on reading, not on writing, with the assumption that we read data more often than we write to it. Most deadlocks / livelocks are not applicable to RCU. But again, some deadlocks can still happen; besides, RCU can be hard to implement to a data structure.

So, locks are not composable. Can we do better than this?

Go is famous for the following saying.

> Don't communicate by sharing memory, share memory by communicating.

Indeed, you can solve the philosophers' problem by communicating.
That is the *Chandy / Misra solution*. Each philosopher but one takes the fork on his right.
The one that can takes the fork on his left.
Then, whenever they need a fork, they request it to its owner,
which gives it if he is done eating.
This brilliant solution doesn't stop by
avoiding deadlocks, it also avoids livelocks by adding a "dirty fork" system.
Philosophers give forks that they have used, and the new user of a fork cleans it.
On the other hand, philosophers cannot give a clean fork.
That way, there is a guarantee that forks are really used.

I actually wonder how Tony Hoare didn't think of that solution when writing
[his famous CSP paper](http://www.usingcsp.com/cspbook.pdf).

I believe you can use channels for any concurrency problem, but sometimes the solution
can be hard to find. Maybe this is the reason why the Go authors feature slides
that use mutexes, or why they have a mutex package in the standard library to begin with.

If channels are hard, don't fallback to a dangerous primitive such as mutexes,
use an equally powerful one!

Lately, there has been an interesting project, called **STM**
(Software Transactional Memory),
which has been pioneered by Haskell's GHC compiler. It uses three primitives,
`atomically`, `retry` and `orElse`, and encapsulates sensitive data in an STM shell,
to ensure that this variable is protected from all issues related to deadlocks.
Within an `atomically` block, modifications to those variables are logged. All operations
are reversible. If the variable has been changed in the meantime, those operations are
rollbacked, and the block is tried again, until it is committed for good.

This system, which may remind you of what concurrent databases have done for years,
is so simple and so bright that Intel has decided to implement it in hardware
in future chips.

I can only hope that programming languages make it easy to use this capability.
Especially considering how long we have been struggling with those issues.

## One Last Thing…

Some in-depth information.

Right now, each goroutine has a segmented stack that starts with 4kB and increases if, at
the start of each function call, the needed augmentation of stack size requires more
space than available.

The scheduler to switch from one goroutine to the next actually has no preemption capability.
Those goroutines are doing simple cooperative multithreading.
Every time a goroutine reads from a channel, it waits, and the scheduler looks for another
goroutine to run. If none are available, we get a deadlock.

Obviously, adding preemption, which is something that I believe the Go authors plan on doing,
would make race conditions that harder to debug.

As a result, I really hope they start implementing and advocating for STM
soon.

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2012-07-02T21:44:00Z",
  "keywords": "go" }
</script>
