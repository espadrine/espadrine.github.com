# A Primer On Randomness

Last October, during a one-week hiking holiday in the birthplace of alpinism,
I got particularly interested in random generators.

Four reasons why they are fascinating:

1. It is only once you track it that you realize just in which gargatuan proportions you **exude information**. Even tiny systems that encode very little data and whose entire purpose is to never leak it (ie, random generators), do so in ways that can be measured, and even exploited. In every instant of your life, during every interaction with someone, billions of muscle movements, tiny and large, only occur because of past events burnt into your brain’s circuits, and betray this private history. Given enough of it, an aggregator could rewind the world and extract minute details from the past.
2. All of **symmetric cryptography** completely hinges on randomness. Security proofs fully rely on the analysis of how little information you can extract from a stream, which requires the stream to effectively look random.
3. Studying them, and trying your hand at making them, helps you understand the **scientific method** better. Most real-world principles can never be proved with absolute certainty; you need to accurately detect a signal in the noise, and measure the likelihood that this signal is not just you seeing patterns in the static.
4. Finally, it helps both understand **the virtue of mixing**, and how best to stir. The effect of mixing is exponential, which is unnatural to mentally harness. On the plus side, when done well, you get fluid exchange of information, remix, and cultural explosion. On the minus side, you get COVID-19 everywhere. Striking the right balance gets you far: many optimizing algorithms rely on it such as genetic algorithms, stochastic gradient descent, or cross-validation sampling in machine learning, which each are heavy users of pseudo-random sources. The results speak for themselves: AlphaGo, for instance, beat the best human player at one of the hardest games on Earth, using Monte-Carlo Tree Search. Yes, you guessed it, they call it Monte Carlo for a reason.

## Information Theory

A good Pseudo-Random Number Generator (or PRNG for short) is indistinguishable from a true random output.

*So, where do we get this true random output you speak of?*

True randomness has statistical meaning, but it is impossible to prove or disprove.
You can only have a high confidence.

You might hope that true randomness can be extracted from nature, but that is also not true.
The physical realm contains a large quantity of data storage (“space”),
and laws that alter it: gravity, electromagnetism, …
Nature is a state transition function and an output; that is also the structure of a PRNG.

Physical processes that claim to output “true” randomness rely on the large amount of information stored in the environment, and that environment’s diffuse state scrambling, that is presumably extremely hard for an attacker to detect.

For instance, the fine trajectory of electrons attracted from atom to atom through an electrical circuit causing minuscule delays, or the chaotic motion of gaseous atoms, or stronger yet, quantum behavior of particles. 

Some physicists may argue that the world is not fully deterministic.
However, the Copenhagen Interpretation or Multiverse fans
cannot disprove the possibility of a non-local world that complies with the Bell-EPR paradox,
for instance through superdeterminism or pilot waves.
(Sorry for those that don’t care about quantum mechanics;
you don’t need to understand this paragraph to carry on.)

Since true randomness is not real, how do we get close?

Let’s say that you generate bits. If all the bits were `1`, it would be pretty predictable, right?
So the frequency of ones should converge to one out of two, which is what probability half is.

But if the output was a one followed by a zero continuously (`101010…`), it would be predictable too!
So the frequency of the sequence `10` in the output should converge to one out of four.

More generally, every possible sequence of `n` bits should appear with a frequency converging to `1÷2ⁿ`.

(A common romanticization of that idea is the comment that the decimals of π encode the entire works of Shakespeare.
π being irrational, its formulation is [orthogonal to any fractional representation][Weyl], which is what decimals are.
That gives strong credence to the conjecture that its digits form a truly random sequence.)

That idea might make you uneasy. After all, it gives an impossible requirement on the memory size of a generator.

### Memory

If your state contains `i` bits, what is the largest sequence of consecutive ones it can output?

Well, since the PRNG is deterministic, a given state will always yield the same output.
There are `2ⁱ` possible state configurations, so with this entropy, you can at best output `i·2ⁱ` bits
before you arrive at a previous state and start repeating the same output sequence again and again.

At least, with an ideal PRNG, you know that one given configuration will output a sequence of `i` ones.
The previous configuration (which transitioned to the configuration that outputs the `i` ones)
cannot also output a sequence of `i` ones:
if two configurations yielded the same output, then there would be some `i`-bit output that no configuration produced.
That would not be an ideal PRNG.

So let’s say that the previous configuration gives `i-1` ones (a zero followed by a ton of ones),
and that the next configuration gives `i-1` ones (a ton of ones followed by a zero).
That is a total of a maximum of `3×i-2` consecutive ones.

Thus, you cannot get `3×i-1` consecutive ones…
which a true random generator would output with a frequency of `1 ÷ 2^(3×i-1)`.
A statistical deviation that you can detect to disprove that a generator is truly random!

Conversely, it means that *true generators require infinite memory*, which is impossible in the real world.

(By the way, yes, it does seem like computing all the digits of π requires infinite memory.
All current algorithms need more memory the more digits are output.)

In practice, you get around the issue by picking a state size `i` large enough that
detecting this statistical anomaly requires a millenia’s worth of random output, too much for anyone to compute.

### Cycle Analysis

So, once we have picked a state size, now we have an upper bound for the period of the PRNG:
it will repeat the same sequence at least every `2ⁱ` bits.

But of course, your mileage may vary. An imperfect generator might have a much lower period.
Unless you have a mathematical proof for a **lower bound**, maybe your family of generators
has a seed (an initialization parameter) which results in the same output being repeated over and over…
That is called a fixed point.

Even if there are no fixed point, there could be a large number of seeds that start repeating soon!
(That was a real [vulnerability in the RC4 cipher][], by the way.)

[vulnerability in the RC4 cipher]: https://www.cs.cornell.edu/people/egs/615/rc4_ksaproc.pdf

On the plus side, there is a counterintuitive phenomenon that develops
when a set of links randomly connect with each other in closed chains.
Most links end up on long chains.
For instance, with two links, they will be connected in a chain half the time;
with three links, each link will be connected to another link with probability ⅔; etc.

Better yet, if you increase the number of links linearly,
you decrease the proportion of links that are part of small chains exponentially.

The bottom line is this: you can always put lipstick on the pig by increasing the state size,
and your generator will look good.

However, a fundamentally better generator would have become even better yet with an increased state size.

### Reversibility

If you build out the design at random, a danger lingers.
Unless you are careful, you might build an irreversible generator.
Given a state after a generation, can you mathematically compute the previous state?

If you can’t, then there are multiple initial states that can transition to the current state.
That means some states can never happen, because there are no initial state that transitions to them;
they got stolen by the states with multiple previous states pointing to it!

That is bad. Why?

First, it reduces the potency of your state size (since a percentage of possible states are dead).

Second, many seeds merge into the rail tracks of other seeds,
converging to a reduced set of possible streams and outputting the same values!

If you build a **reversible** algorithm, at least each possible state is useful,
and inter-seed correlation is less probable.

Note that a reversible design does not mean that the state cycles through all possible combinations.
It just means that each state points to exactly one other state, and has exactly one state leading to it.
In other words, it is a *bijection*, but not a *circular permutation*.

### Diffusion

Claude Shannon made [a very good point the other day][Sha45] (I think it was in 1945?) about ciphers.
An ideal pseudo-random source is such that any bit of the input flips half the bits of the output.

More precisely, ideally, the probability that any bit of the stream flips if a given bit of the state flips, should be ½.
That is called **diffusion** of the state.

After all, if it wasn’t ½, I could start making good guesses about whether this bit of the state is set,
and slowly recover pieces of the state or even the key.
And suddenly, I can predict the whole stream.

A related concept is **confusion** of the key.
Ideally, each bit of the output depends equally on a combination of all bits of the key.
So, each bit of the key should change each bit of the stream,
for half of the set of possible configurations of the key’s other bits.

Each bit of the stream should therefore be a complex combination of all of the key’s bits,
while each bit of the key should have an impact stretched along the whole stream.

These properties particularly matter for cryptographic primitives such as ChaCha20,
where the seed of the PRNG is essentially the cipher key.
Their analysis and understanding still matter for PRNG quality;
although some designs don’t take confusion seriously,
leading to severe correlation of distinct seeds.

[Weyl]: https://mathworld.wolfram.com/WeylsCriterion.html
[Sha45]: https://www.iacr.org/museum/shannon/shannon45.pdf

## Tooling

Back in the seventies, there was no tooling to pragmatically study the quality of a generator.
That made the PRNG hobby somewhat impractical.

As a sad result, some people produced subpar results, such as IBM’s infamous [RANDU]:

> It fails the spectral test badly for dimensions greater than 2, and every integer result is odd.

Fortunately, great strides were made since.
Anyone can get going quickly, up until they start having competitive results.

[RANDU]: https://en.wikipedia.org/wiki/RANDU

### History

A first step was Donald Knuth’s description of the use of **Chi-Squared tests** in 1969.

While its application to generators was described in Knuth’s seminal work
*The Art of Computer Programming*, we have to thank Karl Pearson for the concept.

As the story goes, Pearson was disgruntled at scientists estimating all their results
based on the assumption that their statistical distributions were always normal,
when in some cases they very clearly were not. They just didn’t really have any other tool.

So he worked through the theory. Say you make a claim that some value, for which you have samples,
follows a given statistical distribution. (A uniform one perhaps? Like our PRNG outputs?)
Call that “**the Null Hypothesis**”, because it sounds cool.

Your evidence is a set of samples that belong in various categories.
Your null hypothesis is the belief that each category `i ∈ {1,…,k}` appears with probability `pᵢ`.
Maybe the two classes are 0 and 1; maybe they are the 256 possible bytes.

There are `oᵢ` *observed* samples in category `i`.
The theoretical, *expected* number of samples should be `eᵢ` = `n·pᵢ`.
You compute the **Chi-Squared statistic**: `χ²` = `Σ (eᵢ - oᵢ)² ÷ eᵢ`.

That statistic follows a distribution of probabilities,
depending on the degrees of freedom of the problem at hand.
If we are looking at random bytes, each generation must be one of 256 possible outputs:
so there are 255 degrees of freedom.
(If it is not in the first 255, it must be in the last, so the last one is not a degree of freedom.)

![Chi-Squared probability density](https://upload.wikimedia.org/wikipedia/commons/3/35/Chi-square_pdf.svg)

Each possible value of `χ²` you get has a probability of being valid for your null hypothesis.
One value is the most probable one. The further you get from it, the least likely it is that your samples are random.

But by how much?

You want to know the probability that a true random generator’s `χ²` lands
as far from the ideal value as your pseudo-random generator did.
(After all, even a perfect generator rarely precisely lands on the most probable `χ²`,
which for random bytes is 253 with probability 1.8%.)

You can compute the probability that a true random generator’s `χ²` is bigger (more extreme) than yours.
That probability is called a **p-value**.
If it is tiny, then it is improbable that a true random generator would get this value;
and so, it is improbable that what you have is one.

![Chi-Squared distribution](https://upload.wikimedia.org/wikipedia/commons/8/8e/Chi-square_distributionCDF-English.png)

With this tool in hand, you can easily check that a process that pretends to be random is not actually so.

Or, as [Pearson puts it][Pearson]:

> From this it will be more than ever evident how little chance had to do
> with the results of the Monte Carlo roulette in July 1892.

(Not sure why his academic paper suddenly becomes so specific;
maybe he had a gambling problem on top of being a well-known racist.)

Fun sidenote: if you look at the `χ²` formula, notice that if your observed values all hit their expectations,
you will always end up with a `χ²` equal to zero, whose p-value is 1.

Uniform random numbers have this awesome property that their p-values should also be uniformly random,
and the p-values of the p-values too, and so on.

The p-value you want is simply one that is not too extreme (eg, higher than 10¯⁵, lower than 1-10¯⁵).
A p-value of 1 immediately disqualifies your null hypothesis!
Perfect fits are not random; you must have anomalies some of the time.

Let’s get back to Donald Knuth. His advice of using this tool to study pseudo-random efforts defined all subsequent work.

In 1996, another PRNG fellow, George Marsaglia, looked at the state of tooling with discontent.
Sure, those Chi-Squared tests were neat.
But writing them by hand was tedious.

Worse, nothing defined what to observe. Bytes are one thing, but they only detect byte-wise bias.
What about bitwise? What if we count bits, and compare that count to a *Known Statistic* (**bit counting**)?
What if we count the number of successive times one byte is bigger than the one generated just before (**runs test**)?
Or maybe count the number of outputs between the appearance of the same value (**gap test**)?
Or take a random matrix, compute its rank, verify that it validates the *Known Statistic* (**binary rank**)?

Well, he didn’t think about all those tests,
but he did publish a software package that automatically computed p-values
for a dozen of tests. He called it *DIEHARD*.

Some are like the ones I described, some are a bit wilder and somewhat redundant,
some have a bit too many false positives to be relied upon.

But it was the start of automation!

And the start of the systematic extermination of the weak generators.

In 2003, Robert G. Brown extended it with an easy-to-use command-line interface, *[Dieharder]*,
that allowed testing without having to fiddle with compilation options, just by piping data to a program.
He aggregated a few tests from elsewhere, such as the NIST’s STS
(which are surprisingly weak for their cryptographic purpose… Those were simpler times.)

A big jump in quality came about in 2007.
Pierre L’Écuyer & Richard Simard published *[TestU01]*, a test suite consisting of three bars to clear.

- SmallCrush picks 10 smart tests that killed a number of weak generators in 30 seconds.
- Crush was a very intensive set of 96 tests that killed even more weaklings, but it took 1h to do so.
- BigCrush was the real monster. In 8 hours, its set of 106 tests brutalizes 8 TB of output, betraying subtler biases never before uncovered, even in many previously-beloved PRNGs, such as the still-popular Mersenne Twister. A very sobering moment.

TestU01 installed two fresh ideas: having multiple levels of intensity, and parameterizing each test.
The latter in particular really helped to weed out bad generators.
Maybe if you look at all the bits, they look fine, but if you look at every eigth bit, maybe not so much?

The feel of using the programs was still similar, though: you ran the battery of tests,
you waited eight hours, and at the end, you were shown the list of all tests whose p-value was too extreme.

Thence came the current nec-plus-ultra: Chris Doty-Humphrey’s *Practically Random*,
affectionately called [PractRand], published in 2010.

It was a step up still from TestU01:

- Instead of eating one output for one test and throwing it away, it uses output for multiple tests, and even overlaps the same test families along the stream, maximizing the extraction of statistics from each bit of output.
- It took the concept of levels of intensity to a new level. The program technically never stops; it continuously eats more random data until it finds an unforgivable p-value. On paper, it is guaranteed to find one, at least once it reaches the PRNG’s cycle length; but that assumes you have enough memory for it to store its statistics. In practice, you can go very far: for instance, the author’s own sfc16 design reached flaws after 512 TiB — which took FOUR MONTHS to reach!
- It displays results exponentially. For instance, once at 1 MB of random data read, then at 2, then at 4, then at 8, … Every time, it either tells you that there are no anomalies, or the list of tests with their bad p-values.

*(A small note: don’t expect this tooling to be satisfactory for anything cryptographic.
Their study relies on much more advanced tooling and analysis pertaining to diffusion,
differential cryptanalysis, algebraic and integral attacks.)*

I am a big believer in tooling.
I believe it is THE great accelerator of civilization by excellence.
The step that makes us go from running at 30 km/h, to speeding at 130 km/h, to rocketing at 30 Mm/h.
In fact, by the end of this series of posts, I hope to publish one more tool to add to the belt.

[Pearson]: http://www.economics.soton.ac.uk/staff/aldrich/1900.pdf
[ent]: https://www.fourmilab.ch/random/
[Dieharder]: https://webhome.phy.duke.edu/~rgb/General/dieharder.php
[TestU01]: http://simul.iro.umontreal.ca/testu01/tu01.html
[PractRand]: http://pracrand.sourceforge.net/
 
### Hands-On

I don’t actually recommend you start out with PractRand for the following reasons:

- You might make silly mistakes. PractRand can kill generators that looked OK in the 80s fairly instantly. You won’t know if your design didn’t even stand a chance back then, or if it was competitive.
- You might have a coding bug. It would be too bad if you threw away a good starting design just because a mask had the wrong bit flipped.
- Seeing Chi-Square failures helps understand the beginner design space. Yes, you want the output to have high entropy; but while it is obvious that you don’t want a poorly balanced output (eg. one possible sequence appears too often), you also don’t want a highly structured output (eg. all possible sequences appear exactly as often), since random noise must contain anomalies. Seeing a high-entropy generator fail because bytes were slightly too equiprobable helped me appreciate what was undesirable. It is often counter-intuitive, so these beginner lessons help a lot.

I would encourage you to build a silly idea, then pipe 10 MB to [ent].
Check the entropy calculation (it should be somewhere around 7.9999),
and verify that the Chi-Square p-value is between 0.1% and 99.9% with a set of seeds.

Compare it to a good randomness source: `</dev/urandom head -c 10M | ent`.
(When I say good, I mean ChaCha20, which is what Linux uses.)

See what happens when you go from 10M to 100M: does the p-value always decrease, or always increase?
That would be bad, very bad indeed.

Once your Chi-Squared is good, skip all the old tests, and hop into PractRand: `./prng | RNG_test stdin64`.
I recommend specifying the size of your output, so that PractRand can know what to look out for.

Then, goes the contest.

If you pass 1 MiB: you have beat the sadly very widely-used [drand48]! (Java, C, …)

If you pass 256 GiB: you are now better than the widely-used [Mersenne Twister]! (Ruby, Python, …)

If you pass 1 TiB: congratulations, you beat the famous [RC4] stream cipher!
(Used as macOS’s old arc4random source, and actually most websites used it for TLS at some point…)

If you pass 32 TiB: you have won. The `RNG_test` program automatically stops.
Beware: it takes about a week to compute… when your generator is fast.

Quick advice: remember that p-values should be uniformly random.
It is inevitable to have some of them be labeled “unusual”, or even, more rarely, “suspicious”.
It does not mean you failed.

When the p-value is too extreme, PractRand will show “FAIL!” with a number of exclamation marks proportional to how horrified it is.
Then, the program will stop immediately.

Some tests will fail progressively.
If the same test shows “unusual” at 4 GiB, and “suspicious” at 8 GiB,
it will probably fail at 16 GiB.

### Speed

Once you beat 32 TiB of PractRand, you know your generator is good —
but to be useful, it also must be the fastest in its class.

A few notes can really help you get it up to speed.

First, you want to be as close to the metal as you can. Code in C, C++, or Rust.

Second, understand the assembly output. Looking at the compiled assembly with `gcc prng.c -S -o prng.asm` can help.
I recommend [Intel’s introduction], [AMD’s manual] and [Agner’s instruction tables].

In particular, a number of amd64 opcodes are inaccessible from the programming language.
You can access them in various ways:

- The compiler will smartly use them when they apply. For instance, there is an opcode to rotate the bits of a variable leftward: `ROL`. But all the C programming language offers is shift (`>>` for `SHR`, `<<` for `SHL`). However, the compiler will map `(a << 1) | (a >> 63)` to the 64-bit `ROL`.
- Compilers usually include header files or libraries to access those instructions, by exporting functions that compile down to the corresponding instruction. Those are called **[intrinsics]**. For instance, our friend the 64-bit `ROL` appears as `_rotl64(a, 1)`, if you `#include <immintrin.h>`.
- SIMD operations heavily depend on your mastery of the compiler. You can either access them through assembly, compiler flags, or intrinsics (my favorite).

Third, understand the way [the CPU processes the assembly][AgnerMicroarchitecture].

- **[Instruction pipelining]**: Every instruction executed goes through a number of phases:  
  ① the instruction is decoded from memory and cut in micro-operations (μops);  
  ② each μop is assigned internal input and output registers;  
  ③ the μop reads input registers;  
  ④ it is executed;  
  ⑤ it writes to the output register; and finally  
  ⑥ the output register is written to the target register or memory.  
  Each of those stages start processing the next instruction as soon as they are done with the previous one, without waiting for the previous instruction to have cleared all steps. As a result, a good number of instructions are being processed at the same time, each being in a different stage of processing.  
  *Example gain: successive instructions go faster if each stage of the second one does not depend on the first one’s later stages.*
- **Superscalar execution**: Each μop can be executed by one of multiple execution units; two μops can be executed by two execution units in parallel as long as they don’t have inter-dependencies. There might be one execution unit with logic, arithmetic, float division, and branches; one execution unit with logic, arithmetic, integer and float multiplication; two with memory loads; one with memory stores; one with logic, arithmetic, SIMD permutations, and jumps. Each have a different combination of capabilities.  
  *Example gain: adding a second instruction doing the same thing, or something belonging to another unit, may not add latency if it acts on independent data.*
- **Out-of-order execution**: Actually, after the μop is assigned internal registers, it is queued in a ReOrder Buffer (ROB) which can store about a hundred. As soon as a μop’s input registers are ready (typically because of a read/write constraint: another μop wrote the information that this μop needs to read), it gets processed by the first execution unit that can process it and is idle. As a consequence, the CPU can process instructions 2, 3, etc. while instruction 1 waits on a read/write dependency, as long as the next instructions don’t have read/write dependencies with stalled instructions.  
  *Example gain: you can put fast instructions after a slow (or stalled) instruction without latency cost, if they don’t depend on the slow instruction’s output.*
- **Speculative execution**: When there is a branch (eg. an if condition), it would be awful if the whole out-of-order instruction pipeline had to stop until the branch opcode gave its boolean output. So the CPU doesn’t wait to know if the branch is taken: it starts processing the instructions that come after the branch opcode. Once it gets the branch opcode output, it tracks all μops that wrongly executed, and reverts all their work, rewrites the registers, etc.
- **Branch prediction**: To get the best out of speculative execution, CPUs make guesses as to what the boolean output of a branch is going to be. It starts executing the instructions it believes will occur.  
  *Example gain: make your branches nearly always take the same path. It will minimize branch mispredictions, which avoids all the reverting work.*

Finally, beware of the way you test performance. A few tips:

1. Use the `RDTSC` CPU opcode to count cycles, as below.
2. Disable CPU frequency variability. CPUs nowadays have things like Turbo Boost that change your frequency based on how hot your processor gets and other factors. You want your CPU to have a fixed frequency for the whole process.
3. Have as few other processes running as possible. If a process runs in the background, eating CPU, it will affect the results.

```
#include <x86intrin.h>

int main() {
  __int64_t start = _rdtsc();
  generate_one_gigabyte();
  __int64_t cycles = _rdtsc() - start;
  fprintf(stderr, "%f cpb\n", ((double)cycles) / 1073741824);
}
```

[Intel’s introduction]: https://software.intel.com/en-us/articles/introduction-to-x64-assembly
[AMD’s manual]: https://www.amd.com/system/files/TechDocs/24592.pdf
[Agner’s instruction tables]: https://www.agner.org/optimize/instruction_tables.pdf
[intrinsics]: https://software.intel.com/sites/landingpage/IntrinsicsGuide/
[AgnerMicroarchitecture]: https://www.agner.org/optimize/microarchitecture.pdf
[Instruction pipelining]: https://software.intel.com/en-us/blogs/2011/11/22/pipeline-speak-learning-more-about-intel-microarchitecture-codename-sandy-bridge

### Designs

The earliest design is the **LCG** (Linear Congruent Generator).
You can recognize its dirt-simple state transition (a constant addition or multiplication),
which has neat consequences on the analysis of its cycle length (typically 2^statesize).
Usually, the output is treated with a shift or rotation before delivery.
While they look fairly random, they can have severe issues, such as hyperplane alignment.
They also tend to be easy to predict once you reverse-engineer them,
which is why they are not used for anything remotely in need of security.

Examples of LCG abound: [drand48], [Lehmer128], [PCG], …

Then come **Shufflers** (eg. [RC4], [ISAAC], [EFIIX]).
Usually have an “I” in the name (standing for “indirection”).
They try to get randomness by shuffling a list, and they shuffle the list from the randomness they find.
Do not recommend. It is so easy for bias to seep through and combine destructively.
Besides, weeding out bad seeds is often necessary.

**Mixers** rely on a simple transition function,
usually addition to what is sometimes called a “gamma” or “[Weyl coefficient][Weyl]”.
A common non-cryptographic pattern is a state multiplication, just like in LCG,
and the output is XORed with a shifted or rotated version of itself before delivery.
The second step is basically a hash.
(To the security-minded readers: I am not talking about collision-resistant compression functions.)
In cryptography, usually, the mixer uses some ARX combination for bit diffusion (ARX = Add, Rotate, XOR),
and is scheduled in multiple rounds (which are basically skipping outputs).
Examples include [wyrand], [SplitMix], [Xorshift128+], [AES-CTR], and the beloved [ChaCha20].

Finally, the most haphazard of them: **chaotic generators**.
They typically have no minimal cycle length, and they just try to stir things up in the state.
For instance, [jsf] and [Romu].

[Mersenne Twister]: http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html
[drand48]: http://man7.org/linux/man-pages/man3/drand48.3.html
[Lehmer128]: https://lemire.me/blog/2019/03/19/the-fastest-conventional-random-number-generator-that-can-pass-big-crush/

[RC4]: https://cypherpunks.venona.com/archive/1994/09/msg00304.html
[ISAAC]: http://burtleburtle.net/bob/rand/isaacafa.html
[EFIIX]: http://pracrand.sourceforge.net/RNG_engines.txt
[PCG]: https://www.pcg-random.org/
[SplitMix]: http://gee.cs.oswego.edu/dl/papers/oopsla14.pdf
[Xorshift128+]: http://vigna.di.unimi.it/ftp/papers/xorshiftplus.pdf
[AES-CTR]: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf
[ChaCha20]: https://cr.yp.to/chacha/chacha-20080128.pdf
[wyrand]: https://github.com/wangyi-fudan/wyhash
[jsf]: https://burtleburtle.net/bob/rand/smallprng.html
[Romu]: http://www.romu-random.org/

## Parting Fun Facts

I mentionned ChaCha20 a lot, because it is one of my favorite cryptographic primitives.
I’ll give you a few fun facts about it, as goodbye.

1. ChaCha20 [initializes its state][Salsa20] with the ASCII for “expand 32-byte k”. It’s a wink on the purpose of the cipher: it takes a 256-bit key, and expands it to a large random stream.
2. It is based on the design of [a joke cipher that plays on a US law][djb export] cataloguing encryption as munition, except if it is a hash. He built it as a simple construction on top of a carefully-constructed hash. Calling the core construction a hash caused him trouble later as [reviewers misunderstood it][salsa hash].
3. The initial name of that cipher was Snuffle. (Yes.)

[Salsa20]: https://cr.yp.to/snuffle/salsafamily-20071225.pdf
[djb export]: https://cr.yp.to/export/1996/0726-bernstein.txt
[salsa hash]: https://cr.yp.to/snuffle/reoncore-20080224.pdf

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2020-03-27T15:17:57Z",
  "keywords": "prng, crypto" }
</script>
