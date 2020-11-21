# A Learning Resource for the NATO Phonetic Alphabet

<iframe src=https://espadrine.github.io/nato-alphabet/
  style='width:100%; height:1000px; border:0'></iframe>

A while back, I wrote [a resource][learn]
to help me learn the [NATO phonetic alphabet][NATO].

*(Link to [the full website here][learn].)*

## What does this resource do well?

A major aspect of good learning, is the randomization of tests.

When you must remember by heart a large number of element,
a common mistake I find in schoolbooks
is for the exercises to repeat only the past ten new words or so.

It is critical, to achieve a leveled, continuous learning experience,
to randomly sample all words previously learnt,
regardless of how old.
That counteracts the inevitable forgetting of short-term-memory words.

*If you can **predict** the words that your memory must remember,
you will subconsciously forget the words that won’t appear.*
Worse, you may link them to the predictable sequence of words
that the test is built on,
causing you to only remember one word when it is next to the other,
which in real life, it will often not be.

This principle is noticeably unfollowed in language manuals,
with predictable effects on my own learning.
I was (and am) frustrated to not have tools like these.

Good randomness is critical to healthy knowledge acquisition.

In fact, many machine learning systems heavily depend on that insight.
For instance, [AlphaGo][] carefully randomized the sequence of games
and the stage of the games that it had to learn,
to avoid the system from overfitting on one game, or on the late game.

## Why did I want to learn it?

When investigating production issues,
developers and operations managers often have to communicate identifiers
so they can share their findings.

> — “*Hey, take a look at payment authorization number
> `78223a6b-6b41-41ac-9cc1-00b76a664ac9`:
> the amount matches the settlement we are looking for.*”

**Sequential identifiers** are short (at first),
but betray information about when the entity was created,
which is often not welcome.
*Identifiers should never contain potentially secret information.*

**Traditional UUID v4** are not great at transmitting identifiers efficiently,
especially vocally.

Indeed, sequences of digits have a higher error rate when vocally transmitted.
They are easy to confuse with each other, after all;
using a larger glyph set increases distinguishability.

[At work][Qonto], we do have a lot of UUIDs.
In many spots in the deeper core of the system, however,
I opted for **128-bit CSPRNG-produced base64 identifiers**.
They are shorter (⌈128÷log2(64)⌉ = 22 characters)
and harder to mistype.

Looking back, one flaw with those is that it is very hard
to communicate them vocally.
You always end up having to specify uppercase / lowercase.
Even when mentally copying these IDs on your own,
you often use the wrong case.

Instead, **base32** does away with case,
making it very suitable for vocal transmission.
When lowercase, it is even particularly easy to read.

I must not be the only one with that opinion.
In fact, in the Bitcoin world,
the account number format has been switched from a base58 one,
to the new [Bech32][] addresses introduced with SegWit.
Behold, it uses lowercase base32!

> `bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`

Of course, Bitcoin addresses are still very long.
Too long to transmit in a single breath.

We could constrain ourselves to 128 random bits,
yielding a ⌈128÷log2(32)⌉ = 26-character identifier.
As long as the entire alphabet!

There is a shorter technique:

1. Identifier generator nodes are globally assigned a random 16-bit number.
2. They all share a 128-bit secret.
3. They each have a separate 48-bit counter that they increment for each new ID.
4. Each new identifier is `PRP((nodeID << 48) ^ counter, secret)`,
   where PRP is a 64-bit block cipher, like [Speck64/128][] or XTEA.

Since a block cipher is a [Pseudo-Random Permutation][PRP] (or PRP for short),
it will cycle through all 64-bit values without repetition.
The output will be essentially indistinguishably random,
avoiding leaking information about the identified object.
And a 64-bit number is only 13 characters of base32!

> — “*Hey, take a look at payment authorization number `nhimasuge7f52`:
> the amount matches the settlement we are looking for.*”

That, finally, can be easily transmitted using the NATO system.

*(This system is likely overkill, but a fun thought.)*

---

*[Click to comment.][Comments]*

[learn]: https://espadrine.github.io/nato-alphabet/
[AlphaGo]: https://deepmind.com/blog/article/alphago-zero-starting-scratch
[NATO]: https://www.nato.int/cps/en/natohq/declassified_136216.htm
[Qonto]: https://qonto.com/en
[Bech32]: https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki
[PRP]: https://en.wikipedia.org/wiki/Pseudorandom_permutation
[Speck64/128]: https://nsacyber.github.io/simon-speck/
[Comments]: https://www.reddit.com/r/espadrine/comments/jydh6k/a_learning_resource_for_the_nato_phonetic_alphabet/

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2020-11-11T19:18:25Z",
  "keywords": "codes" }
</script>
