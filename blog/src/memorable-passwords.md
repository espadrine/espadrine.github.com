# Memorable passwords

We are slowly getting to a comfortable password situation.

Research has improved on which passwords are easier to remember.
Cryptographers have [strenghtened the cost][Argon2-KDF] of cracking weak passwords.
People are more aware of the security risks,
and the usage of password managers grows.

The consensus on password handling is this:

1. Keep a very strong master password in your head, stored nowhere.
2. Use it to unlock your password manager.
3. Use your password manager to store and create very random passwords for individual websites.
   You would never be able to remember them, but you only need to remember the master password.
   Typically, for alphanumerical outputs, you need ⌈128÷log2(26·2+10)⌉ = 22 characters.
4. The websites, and more importantly, the password manager,
   use a key derivation function such as [Argon2][Argon2-KDF] either on the front-end
   (server relief) or on the backend, and only stores the output.
   It ensures computation is both time-hard and memory-hard, with settings kept up-to-date
   to ensure that each computation takes 0.5 seconds and/or 4 GB of RAM.

But some details are left unset: exactly how strong should the master password be?
How do we even know?
Can this situation converge to an easier user experience for login on the Web?

## Password hashing

Some accurate statements may be surprising to the general population.
This is one:

**Multiple passwords can unlock your account.**

The reason? Your password is not compared byte-for-byte (thankfully!)
but through a hashing method that does not map one-to-one.

Indeed, hashes have fixed sizes (typically 256 bits),
while passwords have arbitrary length.

Overall, this consideration is unimportant,
because virtually no password is strong enough
to even compete with the collision risk of the hash:
it is tremendously more likely for a collision to be caused by
the generation process, than by the hash,
whose collision risk is 2<sup>N÷2</sup>
where N is the size of the hash, typically 256 bits nowadays.

On top of this, some companies build their login system
in a way that is more resilient to user error,
such as [having caps lock on][Facebook passwords].

That too is irrelevant, since the search space is typically only reduced
by one bit (corresponding to the choice between setting caps lock or not).

## Target strength

[Some suggestions target specific cryptographic algorithms][StackOverflow strength suggestion].
But this pushes machine limits into human constraints:
algorithms require 128-bit security, not because 127 is not enough,
but because it is a power of two that neatly fits with various engineering techniques.

The real human constraint is your lifetime.
Once you are dead, it does not matter too much to your brain whether your secrets are out,
since your brain becomes mulch.

The longest person alive is a French woman that died nearly reaching 123.
Let’s imagine that health will improve
such that someone will live double that amount, Y = 246 years.
What is the minimum strength needed to ensure they won’t have their secrets cracked alive?

Current compute costs hover around €3/month on low-end machines.
Let’s imagine that it will improve a hundredfold in the coming century.

The NSA yearly budget is estimated at B = €10 billion.
Can they hack you before you die?

First, under those assumptions,
assuming the NSA consumes its whole budget cracking you,
how many computers will it use to crack you in parallel?
The result is B ÷ 12 ÷ 0.03 = 28 billion servers.

If your password has an N-bit entropy,
it will take 2<sup>N-1</sup>·0.005÷P÷3600÷24÷365 years on average,
assuming the NSA is brute-forcing with CPUs that can do one attempt every 5 milliseconds
(a hundredth of the [Argon2][Argon2-KDF] recommended setting,
to account for the possibility that the NSA has machines a hundred times more powerful
than the rest of us, which is both unlikely, and would not cost what we estimated).

As a result, our formula for picking strength is
N = log2(B÷12÷0.03·Y·365·24·3600÷0.005) + 1 = 77 bits of security.

Note that we can assume that a good KDF is used,
since we are only worried about password strength for the password manager,
which should be pretty good at choosing the right design.
The password manager will generate all normal passwords above 128 bits of security anyway.
(Except for those pesky websites that inexplicably have an upper password length limit.
But those are beyond saving.)

I parameterized some values so that you can plug your own situation.
For instance, if you make a password for your startup
that you believe will beat the odds of an average 5-year lifespan,
and become a behemoth a thousand years into the future, you can set Y = 1000
and get a very slight increase to 79 bits.

If you instead believe that your adversary will spend a trillion euros every year,
you can bump things up to 83 bits of security.

## Master password generation

How do you convert a number of bits of security into a master password?
Well, those bits represent the amount of entropy of the random generator.
Or in other words, the quantity of uncertainty of the password-making process.

Each bit represents one truly random choice between two options.
If you have four options, it is as if you made two choices, and so on.

A good way to make memorable master passwords is to pick words among large dictionaries,
since picking from a long list adds a lot of entropy (since there are so many binary choices)
but each word is very distinctively evocative.

However, each word is independent, and therefore,
making stories in your head that combines those words gets harder the more words there are.
So we randomize the word separators as symbols,
which both adds entropy (so that we can have less words),
and is not too hard to remember. Besides, breaking words apart ensures that
we don’t lose entropy by ending up with two words that, concatenated,
are actually a single word from the same dictionary.

I implemented these principles on [this passphrase generation page][passphrase].

## Thank you, Next

I feel strongly that passwords are passé.
I would love to talk about my hopes for the future of Web authentication.

[Argon2-KDF]: https://password-hashing.net/argon2-specs.pdf
[Facebook passwords]: https://www.zdnet.com/article/facebook-passwords-are-not-case-sensitive-update
[StackOverflow strength suggestion]: https://crypto.stackexchange.com/questions/60815/recommended-minimum-entropy-for-online-passwords-in-2018
[passphrase]: https://espadrine.github.io/passphrase/

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2020-06-24T19:50:27Z",
  "keywords": "crypto" }
</script>
