# Insanities of a File System Object Storage

*(TL;DR: I present [fsos][]; but read on to know why.)*

How do you update a file in Node.js?

Well, let's browse our dear [file system API][]…

[file system API]: https://nodejs.org/api/fs.html

```js
fs.writeFile(file, data)
```

Simple enough, isn't it?

And yet, there are so many kinds of wrong in this seemingly obvious answer.

## POSIX

Let's first educate ourselves. Node.js' file system API is designed to imitate
and target POSIX, a specification to etch the core Unix experience in granite.
While the main reason for the success of Unix was portability, ensuring that
userland programs could run on different machines, the three tenets of its
design were also delicious (**plain text** as universal interface, composable
programs via a **shell**, and a **hierarchical file system** offering a unified
interface to kernel functionality (not just data storage)).

Naturally, everybody stole those juicy ideas. When Richard Stallman famously
chose to write a free operating system to oppose what we would today call DRM,
he wanted Unix compatibility. When compatibility is seeked, standardization
becomes necessary. IEEE sprung into action in the form of SUS (the Single Unix
Specification), and, with Richard's suggested name, wrote the Portable Operating
System Interface, **POSIX**.

Richard's baby, **GNU**, had little impact without a proper kernel. It was a
mere collection of programs that would talk to a Unix file system if there was a
free one. Fortunately, a free one arose, birthed as **Linux**, and gained major
adoption thanks to its sweet mix of speed, stability, and a healthy dose of
bright experiments. When **Node.js** was created, Linux was the overwhelming
king of the server-side, which Node.js wanted to conquer.

In a way, the reason that the obvious one-liner above doesn't work is Unix'
fault. It designed file interaction in a manner that made a lot of sense for
some uses of the file system, disregarding others. Behind the covers, each
file is a mere set of contiguous disk space (blocks, extents, or sectors) that
point to each other, so it stands to reason that appending data at the end is
probably faster than appending it at the beginning, just as it is with a diary.

The standard C library defined by POSIX reflects the internal design of Unix
file systems without hiding its flaws. Consequence: internally non-obvious
operations have non-obvious solutions, and non-solutions that are as tempting to
use as a chocolate cookie (up until your tongue warns you that it was in fact
raisins).

The most critical interface for file operations is [open][]. It returns a file
descriptor to operate the file. It takes a handful of required flags and a ton
of optional ones. Most famous amongst the required ones are `O_RDONLY` if you
will only read, `O_WRONLY` if you don't feel like reading anymore, and `O_RDWR`
if you hate picking a side.

Among the optional flags, `O_CREAT` creates the file automatically if it doesn't
exist, `O_TRUNC` empties the file, and `O_APPEND` forces you to write only at
the end. (What a coincidence that appending is both fast in file systems and
has a shortcut!)

However, most people use [fopen][], a layer on top of [open][], which
unfortunately has very strange defaults. Instead of the flags we understand, it
has string modes that seem to mean something they do not do. Here are the
nonsensical rules.

- `"r"` is the only one that prevents writing,
- If the string has an `r`, it doesn't create a file automatically,
- If the string does not have a `+`, it cannot both read and write,
- If the string has a `w`, it empties the file,
- If the string has an `a`, all writes append to the file (finally one that
  does what is on the cover!)

For instance, `"r+"` can write, but won't create a file automatically for some
reason.

The modes offered by [fopen][] barely target what people actually do with a
file:

1. Read a configuration file: `"r"`,
2. Write logs: `"a"`,
3. Update a whole file: nothing.

For more precise operations, use `"r+"`. All other possibilities are most likely
bugs waiting to be found. Special mention to `"w+"` which empties the file it
allows you to read! In fact, the main lesson of this blog post is that `O_TRUNC`
has only one, very rare, use-case: *emptying a file, without removing it,
without writing to it*. You should essentially never use `"w"`.

Naturally, Node.js favours [fopen][]-style modes, instead of the more elegant
[open][].

Naturally, its default mode for write operations is the useless `"w"`.

[open]: http://pubs.opengroup.org/onlinepubs/9699919799/functions/open.html
[fopen]: http://pubs.opengroup.org/onlinepubs/9699919799/functions/fopen.html

## Async IO

Now that we have background information, let's dig into the first issue.

A long-standing problem in HTTP server software is [C10K][], ie. hitting 10k
concurrent clients to serve with a single machine. A large part of beating that
figure is dealing with how slow IO is. Fetching a file on disk takes a long
time! And by default, POSIX system calls make your program wait for the file to
be read, and your program just sits there doing nothing in the meantime, like a
passenger waiting for the bus to come.

[C10K]: http://www.kegel.com/c10k.html

Fortunately, POSIX includes a special switch to avoid waiting: `O_NONBLOCK`. It
is part of [open][]. When an IO operation is performed, you can do whatever you
want, even though the operation is not done. Later on, you can call `poll()` or
`select()` or `kqueue()` (depending on the OS you use), and learn whether the
operation is done.

Node.js' *raison d'être* was completely focused on how easy JS makes
asynchronous operations. Their whole file system interface recommends using the
non-blocking API. But in some cases, it makes zero sense. So it is with
`fs.writeFile()`. It *never* does what you want. Not with the default
parameters, anyway.

When you use storage, you implicitly expect some level of consistency. If you
write 'hello' to a file which contains 'hi' and then immediately read from it,
you don't expect to read 'who is this?' if absolutely nobody wrote to the file
in the meantime. You expect 'hello' — or, at least, 'hi'. But here, you will
read neither what was in the file before, nor what you wrote in it.

```js
var fs = require('fs')
var fn = './foo'  // file name
fs.writeFileSync(fn, '1234\n')
fs.createReadStream(fn).pipe(process.stdout)  // → 1234
fs.writeFile(fn, '2345\n')
fs.createReadStream(fn).pipe(process.stdout)  // The file is empty.
```

This is the code I submitted as [an issue][old issue] to Joyent's node (prior to
the io.js fork).

[old issue]: https://github.com/nodejs/node-v0.x-archive/issues/7807

So what is going on? Why does it break your implicit consistency expectations?
It turns out that the operations you use are not atomic. What `fs.writeFile()`
really means is “Empty the file immediately, and some day, please fill it with
this.” In POSIX terms, you perform an
`open(…, O_WRONLY|O_CREAT|O_TRUNC|O_NONBLOCK)`, and the `O_TRUNC` empties the
file. Since it is `O_NONBLOCK`, the next line of code gets executed immediately.
Then, Node.js' event loop spins: on the next tick, it polls, and the file system
tells it that it is done (and indeed, it is). Note that it can take many more
event loop ticks, if there is a larger amount of data written.

Fundamentally, why would you ever want those default flags (aka. `fopen`'s
`'w'`)? If you are writing logs or uploading a file to the server, you want
`'a'` instead; if you are updating configuration files or any type of data, you
want… something that will be described in the next chapter. For any type of file
that has the risk of being read, this default flag is the wrong one to use.

So, the problem is that it was non-blocking, right? After all, if we change it
to be synchronous, it all seems to work, right?

```js
var fs = require('fs')
var fn = './foo'  // file name
fs.writeFileSync(fn, '1234\n')
fs.createReadStream(fn).pipe(process.stdout)  // → 1234
fs.writeFileSync(fn, '2345\n')
fs.createReadStream(fn).pipe(process.stdout)  // → 2345
```

Don't you hate it when you read a blog post, and the author ends two
consecutive sentences with “right?”, and you just know it means “false!”

## File Systems

What if your application crashes?

Having your app crash just after you opened the file for writing, but before it
is done writing, will unsurprisingly result in a half-written file — or an empty
one. Since the memory of the crashed app is reclaimed, the data that was not
written is lost forever!

You want to *replace a file*. Therefore, even if the application crashes, you
want to make sure that you maintain either the old version, or the new version,
but not an in-between. `fs.writeFileSync()` does not offer that guarantee, just
as the underlying POSIX primitives. It is tempting, but wrong.

In [the words][Ts'o comment] of Theodore Ts'o, maintainer of ext4, the most used
file system on Linux and possibly in the world (and creator of `/dev/random`):

> Unfortunately, there very many application programmers that attempt to update an existing file’s contents by opening it with O_TRUNC. I have argued that those application programs are broken, but the problem is that the application programmers are “aggressively ignorant”, and they outnumber those of us who are file system programmers.

[Ts'o comment]: http://thunk.org/tytso/blog/2009/03/12/delayed-allocation-and-the-zero-length-file-problem/comment-page-5/#comment-2782

The fundamental issue is that `fs.writeFileSync()` is not atomic. It is a series
of operations, the first of which deletes the old version of the file, the next
ones slowly inserting the new version.

What do we want? The new version! When do we want it? Once written on disk,
obviously. We have to first write the new version on disk, alongside the old
one, and then switch them. Fortunately, POSIX offers a primitive that performs
that switch *atomically*. World, meet [`rename()`][rename].

[rename]: http://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html

```js
var tmpId = 0
var tmpName = () => String(tmpId++)
var replaceFile = (file, data, cb) => {
  var tmp = tmpName()
  fs.writeFile(tmp, data, err => {
    if (err != null) { cb(err); return }
    fs.rename(tmp, file, cb)
  })
}
```

Obviously, I simplify a few things in this implementation:

- We have to verify that the `tmp` file does not exist,
- We should make `tmp` have a UUID to reduce the risk that another process
  creates a file with the same name between the moment we check for its
  existence and the moment we write to it,
- We said before that Node.js was using `'w'` as the default write flag; we want
  to use at least `'wx'` instead. `x` is a Node.js invention that uses `O_EXCL`
  instead of `O_TRUNC`, so that the operation fails if the file already exists
  (we would then retry with a different UUID),
- We need to create `tmp` with the same permissions as `file`, so we also need
  to `fs.stat()` it first.

All in all, the finished implementation is nontrival. But this is it, right?
This is the end of our ordeal, right? We finally maintained consistency, right?

I have good news! According to POSIX, yes, this is the best we can do!

## Kernel Panics

We settled that *write temporary then rename* survives app crashes under
POSIX. However, there is no guarantee for system crashes! In fact, POSIX gives
absolutely no way to maintain consistency across system crashes with certainty!

Did you really think that being correct according to POSIX was enough?

When Linux used ext2 or ext3, app developers used *truncate then write* or the
slightly better *write temporary then rename*, and everything seemed fine,
because system crashes are rare. Then a combination of three things happened:

- Unlike ext3, ext4 was developed with **delayed allocation**: writes are
performed in RAM, then it waits for a few seconds, and only then does it apply
the changes to disk. It is great for performance when apps write too often.
- GPU vendors started writing drivers for Linux. Either they didn't care much
about their Linux userbase, or all their drivers are faulty: the case remains
that **those drivers crashed a lot**. And yet, the drivers are part of the
kernel: they cause system crashes, not recoverable application crashes.
- **Desktop Linux** users started playing games.

What had to happen, happened: a user played a game that crashed the system, at
which point all files that had been updated in the past 5 seconds were zeroed
out. Upon reboot, the user had lost a lot of data.

There were a lot of sad Linux users and grinding of teeth. As a result, Theodore
Ts'o [patched][delayed allocation] the kernel to detect when apps update files
the wrong way (ie, both *truncate then write* and *write temporary then
rename*), and disabled delayed allocation in those cases.

Yes. *Write temporary then rename* is also the wrong way to update a file. I
know, it is what I just advised in the previous section! In fact, while POSIX
has no way to guarantee consistency for file updates, here is the closest thing
you'll get:

1. Read the file's permissions.
2. Create a temporary file in the same directory, with the same permissions,
using `O_WRONLY`, `O_CREAT` and `O_EXCL`.
3. Write to the new file.
4. [`fsync()`][fsync] that file.
5. Rename the file over the file you want to update.
6. `fsync()` the file's directory.

[fsync]: http://pubs.opengroup.org/onlinepubs/9699919799/functions/fsync.html

Isn't it [obvious][don't fear the fsync] in retrospect?

[don't fear the fsync]: http://thunk.org/tytso/blog/2009/03/15/dont-fear-the-fsync/

*Renaming the file before it is `fsync`'ed* creates a window of time where a
crash would make the directory point to the updated file, which isn't committed
to disk yet (as it was in the file system cache), and so the file is empty or
corrupt.

Less harmful, *a crash after renaming and before the directory's cache is
written to disk* would make it point to the location of the old content. It
doesn't break atomicity, but if you only want to perform some action after the
file was replaced *for sure*, you would better `fsync` that directory before you
do something you will regret. It might seem like nothing, but it can break your
assumptions of data consistency.

If you own an acute sense of observation, you noticed that, while Theodore's
patch makes it less likely that “badly written file updates” will cause files to
be zeroed out upon a system crash, the bug always existed and still exists! The
timespan where things can go horribly wrong is only reduced. The fault is
rejected on the app developers.

This issue was “fixed” — well, the patch landed at least — in Linux 2.6.30 on
the most common file systems (ext4 and btrfs).

[delayed allocation]: http://thunk.org/tytso/blog/2009/03/12/delayed-allocation-and-the-zero-length-file-problem/

## Conclusion

Here's one thing to get away from all this: file systems have a design which
works well with certain operations and… not so well… with others. **Replacing a
file is costly!** You should know what you are doing (or use [fsos][], my npm
library which wraps all of this in sweet promises), and only replace files at
worst a few times a second. Ideally a lot less often, especially for large
files.

Realistically, though, what you fundamentally want is not to lose work that is
older than X seconds, for some value of X that is thankfully often larger than
a half.

Besides, this is Node.js. One issue that is common elsewhere with a trivial
implementation is that the main thread waits for the I/O to be finished before
it can move on. In Node.js, we get asynchrony for free. The file replacement
happens essentially in the background. The main thread stays as responsive as a
happy antelope!

[fsos]: https://www.npmjs.com/package/fsos

PS: I feel like I should also advocate for a few things. For every mistake,
there is both a lesson and a prevention; we have only just learned the lesson.
Programmers go to the path of least resistance, and what they face encourages
them to the pit of death. I see two splinters to remove:

1. Linux should offer an atomic file replacement operation that does it all
right. Theodore argues that it is glib's (and other libraries') task, but I
disagree. To me, one of the most common file operations doesn't have its
syscall.
2. Node.js' defaults ought to be improved. `fs.writeFile()` heavily suggests
being used for file updates, and has the default flag of `'w'`. It is a terribly
ill-advised primitive for any use. It should be replaced by `'ax'`, but it
cannot, because of legacy! I recommend having a warning, and a separate
`fs.updateFile()` function.

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2018-05-31T19:42:00Z",
  "keywords": "storage, posix" }
</script>
