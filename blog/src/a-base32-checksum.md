# A base32 checksum

_(Cue: in the voice of a badly-acted TV commercial.)_

> Do you always mistakenly wire money to or from the wrong account?
> I used to do that all day, everyday!
>
> But then, I found base32check, and my life turned upside-down.
> base32check is there for me on my daily purchases, watching out for my
> erroneous transcriptions online and offline! And now, for some reason,
> I smell of roses and there are sparkling AfterEffects™ all around.
>
> Download the base32check whitepaper. Symptoms may include an accelerated heart
> rate, a shortness of breath, and acute depression. Please consult your
> healthcare professional in case of severe brain injury.

## That was weird, let's be boring instead

When credit cards sprung into our lives, they were designed to prevent that.
The last digit served no other purpose than to act as a checksum, computed
from the other digits, using an algorithm by Hanz **[Luhn][]** from 1959.
In his words:

> It is commonly known that in copying a number comprised of a plurality of
> digits it often happens that an error occurs by transposing two of the
> digits.

Luhn's goal was to detect all single-digit errors and most transpositions,
with a single check digit. However, it missed some transpositions, such as
09 / 90.

<div id=luhnWidget>
  <input class=luhnInput value=1234590>
  <strong><output class=luhnValidity>Valid</output></strong>
  (Add a <strong><output class=luhnDigit>6</output></strong> to be valid).
</div>

<script>
// From https://github.com/EDumdum/luhn/blob/master/src/luhn.js
function luhnValid(value) {
  return /^[0-9]+$/.test(value) && luhnRemainder(value) === 0;
}
function luhnGen(value) {
  if (!/^[0-9]+$/.test(value)) { value = ''; }
  return ((10 - luhnRemainder(value + '0')) % 10);
}
function luhnRemainder(value) {
  var array = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9];
  var length = value.length, accumulator = 0, bit = 0;
  while (length-- > 0) {
    accumulator += (bit ^= 1) ? value.charCodeAt(length) - '0'.charCodeAt(0) : array[value.charCodeAt(length) - '0'.charCodeAt(0)];
  }
  return accumulator % 10;
}
function initLuhnWidget() {
  const luhnWidget = document.getElementById('luhnWidget');
  const luhnInput = luhnWidget.getElementsByClassName('luhnInput')[0];
  const luhnValidity = luhnWidget.getElementsByClassName('luhnValidity')[0];
  const luhnDigit = luhnWidget.getElementsByClassName('luhnDigit')[0];
  const updateWidget = () => {
    const value = luhnInput.value;
    luhnValidity.textContent = luhnValid(value) ?  'Valid' : 'Invalid';
    const digit = luhnGen(value);
    luhnDigit.textContent = (digit !== digit) ? 'removal of non-digits' : digit;
  };
  luhnInput.addEventListener('input', updateWidget);
  updateWidget();
}
addEventListener('DOMContentLoaded', initLuhnWidget);
</script>

Whether a single check digit could also detect all adjacent transpositions
was an open question, until 1969, when **[Verhoeff][]** designed another
algorithm that did just that.
Furthermore, he gathered the results of a study into a thorough analysis
of the causes of human errors.

Meanwhile, the International Standards Organization published
[ISO/IEC 7064][] in 1983. It includes algorithms for single- and
double-digit checksums of numerical and alphanumerical inputs, with the goal
to detect all single substitutions and most adjacent transpositions.

They intended it for use in future standards.
For instance, **[IBAN][ISO 13616]** (the International Bank Account Number)
needed a checksum to lower the risk of accidentally transfering funds to the
wrong account number.

Surprisingly, the IBAN system, which supports alphanumeric characters,
relied on MOD 97-10, which was designed only for numeric inputs.

Our analysis indicates that this was a BAD MOVE™.

A root promise of MOD 97-10 as specified in [ISO/IEC 7064][] is to detect
all single substitution errors. Well, not anymore! Not with that
alphabetic-to-numeric conversion. For instance, `IIIIIII80` conflicts with
`IIIII1I80`, `UDODGOP17` with `UDODG0P17`.

<div id=mod97_10Widget>
  <input class=mod97_10Input value=AB123>
  <strong><output class=mod97_10Validity>Valid</output></strong>
  (Add a <strong><output class=mod97_10Digit>92</output></strong> to be valid).
  <p><button class=findCollision>Find collision</button>
  <output class=collision></output>
</div>

<script>
// From https://github.com/arhs/iban.js/blob/master/iban.js
function iso7064Mod97_10(value) {
  var remainder = value, block;
  while (remainder.length > 2){
    block = remainder.slice(0, 9);
    remainder = parseInt(block, 10) % 97 + remainder.slice(block.length);
  }
  return parseInt(remainder, 10) % 97;
}

function iso13616Prepare(value) {
  if (!/^[0-9a-zA-Z]+$/.test(value)) { value = ''; }
  const A = 'A'.charCodeAt(0), Z = 'Z'.charCodeAt(0);
  value = value.toUpperCase();
  return value.split('').map(function(n){
    var code = n.charCodeAt(0);
    if (code >= A && code <= Z){
      // A = 10, B = 11, ... Z = 35
      return code - A + 10;
    } else { return n; }
  }).join('');
}

function mod97_10Valid(value) {
  return /^[0-9a-zA-Z]+$/.test(value) &&
    iso7064Mod97_10(iso13616Prepare(value.slice(0, -2))).toString() === value.slice(-2);
}

function mod97_10FindCollision(value) {
  if (!mod97_10Valid(value)) { return; }
  const target = value.slice(-2);
  const input = value.slice(0, -2);
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < input.length; i++) {
    for (let a = 0; a < alphabet.length; a++) {
      const other = input.slice(0, i) + alphabet[a] + input.slice(i + 1);
      if (other === input) { continue; }
      if (iso7064Mod97_10(iso13616Prepare(other)).toString() === target) {
        return other + target;
      }
    }
  }
}

function initMod97_10Widget() {
  const widget = document.getElementById('mod97_10Widget');
  const mod97_10Input = widget.getElementsByClassName('mod97_10Input')[0];
  const mod97_10Validity = widget.getElementsByClassName('mod97_10Validity')[0];
  const mod97_10Digit = widget.getElementsByClassName('mod97_10Digit')[0];
  const updateWidget = () => {
    const input = iso13616Prepare(mod97_10Input.value);
    mod97_10Validity.textContent = mod97_10Valid(input) ?  'Valid' : 'Invalid';
    const digits = iso7064Mod97_10(input);
    mod97_10Digit.textContent = (digits !== digits) ? 'removal of non-alnums' :
      digits.toString().padStart(2, '0');
  };
  mod97_10Input.addEventListener('input', updateWidget);
  updateWidget();

  const findCollisionBut = widget.getElementsByClassName('findCollision')[0];
  const collisionOutput = widget.getElementsByClassName('collision')[0];
  findCollisionBut.addEventListener('click', event => {
    const other = mod97_10FindCollision(mod97_10Input.value);
    if (other === undefined) {
      collisionOutput.value =
        'No conflicting single substitution found, try adding valid digits.';
    } else { collisionOutput.value = other; }
  });
}
addEventListener('DOMContentLoaded', initMod97_10Widget);
</script>

Furthermore, while it technically allows mixed case, the uppercase letter always
conflicts with its lowercase, essentially making lowercase too risky to
use. Uppercase all inputs.

On the other hand, MOD 97-10 checksums do not produce letters, which leaves
some of the information content of the checksum on the table, that could
otherwise strengthen the checksum.

## A Blank Slate

If we were to redesign the global banking system, how would we improve this?

The goals we want for our imaginary account number are:

1. **Be easy to transmit.** So, text.
2. **Be short**, to simplify copying.
3. **Contain enough space to scale globally**. We don't want to run out of
   account numbers as the population grows. This, along with the previous
   constraint, means that we need to encode as many bits of information as
   we can within each character. base64 maybe? That'd be 6 bits per char.
4. **Minimize human transcription errors**. base64 is notably poor in this
   respect, because of the 0/O and I/l/1/i visual confusion. On the other
   hand, base32 has more information density than just digits, but none of
   the ambiguity. Finally, while base64 contains a dash or a dot that can
   be cut off by text processors, base32 will be selected as a single word
   even when double-clicking.
5. **Allow early detection of errors**. We don't want to inform the user
   of their mistake asynchronously. So the algorithm should be easy to
   implement on the user-interface.

Obviously, I am not the first to look into this. Notably, [Bitcoin][base58]
created a solution for this. How does it work, and how does it fare?

In Bitcoin, the account number is roughly a (cryptographic) hash of the user's
public key, cut and concatenated with a checksum that also uses a cryptographic
hash.

The account number is usually represented in text as [base58][]. It is very
similar to [base64][], except that it removes the 0/O and l/I ambiguity, but
still has the i/1, Z/7, B/8 and S/5 confusion. Besides, transcribing or
communicating mixed-case letters is tedious. Each letter needs mentioning
whether it is uppercase or lowercase. That is why [fourwordsalluppercase][] is a
great WiFi password.

The checksum uses roughly 5 characters (four bytes of [base58][] is 32 ÷
log2(58)). It is fairly big, which at least ensures that there won't be
mistakes… unless the account number goes unchecked. If that is the case, neither
the sender nor the recipient may use the funds transferred.

Sadly, the necessity of a bignum library for base58 decoding, and SHA256 as the
checksum algorithm, makes verifying the checksum laborious to implement.
Few user interfaces embed a validator as a result.

Finally, even if we wanted to replace the checksum with an easier-to-use check
digit, it is not immediately easy to design a base58 check character.

[base32][] avoids many of these inconveniences, especially in lowercase, where
the varied heights are easy to distinguish and where there is no S/5 and Z/7
ambiguity.
However, there isn't a particularly good, dedicated, check character algorithm
for it — yet.

Let's create one.

## base32check1

Luhn, Verhoeff, Damm — some pretty nifty designs are already on the shelves.
Sadly, they mostly focus on digits, which have poor information capacity (3.3
bits per char).

While they can be extended to larger alphabets, that is not trivial nor
standard. (Ah, the joy of tweaking the Verhoeff parameters.) Worse, they are no
longer the coolest kids on the block.

I found a 2016 [paper][Chen 2016] referencing a 2014 one (which I couldn't get
my hands on. Curse the IEEE overseers and their labyrinthic subscription
models! _Please pay $84.50 membership and the paper is $14.95, oh and would you
mind donating because IEEE helps improve the human condition? Also good news, we
offer free shipping for PDF documents._)

No joke, but I digress. The 2014 paper has no value anyway, as the principle is
described in full in the [2016 paper][Chen 2016], available online.

The main insight is this: if your check digit a<sub>n+1</sub> solves Σ aᵢ·Pⁱ = 0
on a finite field where P is the companion matrix of a primitive polynomial,
*it suddenly detects substitutions, transpositions, and twin substitutions* with
up to R characters between them, where R grows with the cardinal. Magic!

(We will dig more into exactly what errors it detects later.)

You must pick two numbers carefully to design your checksum: the cardinal and
the primitive.

- The **cardinal** is the number of elements in the finite field. It is
  therefore also the number of possible checksums. For a single-character check
  digit, it must be smaller than the size of your alphabet.
- The **primitive** does not matter all that much. The most significant part
  about it is that you need to compute one. Unfortunately, brute-force is usually
  the simplest way to find some.

There are two possible cardinals: *prime numbers* and *prime powers*. Prime
cardinals are neat, because operations are scalar. On the other hand, additions
and multiplications on prime power cardinal fields are matricial.

I first wanted a single-character checksum. In order to use all the bits that
this checksum had at its disposal, I needed it to support the full base32
alphabet. That meant the cardinal needed to be 32. Sadly, 32 is not a prime; so
it needed to be a prime power. If 2 is the prime, 2⁵ is the cardinal.

Since the cardinal is not a prime, P is a matrix. Here, its size is 5×5.
To build it, we can pick any order-5 [primitive polynomial][]; I chose 1+x²+x⁵.
To get the companion matrix, set a diagonal of 1s, and set the rightmost column
with the polynomial coefficients, starting with x⁰:

    ⎛ 0 0 0 0 1 ⎞
    ⎜ 1 0 0 0 0 ⎟
    ⎜ 0 1 0 0 1 ⎟
    ⎜ 0 0 1 0 0 ⎟
    ⎝ 0 0 0 1 0 ⎠

Each aᵢ term is a representation of a base32 character as a GF(2⁵) (finite field
of order 2⁵) polynome: a is 0, which we represent as (0 0 0 0 0); b is 1 or (0 0
0 0 1); f is 1+x² or (0 0 1 0 1).

Validating a check character is straightforward: compute Σ aᵢ·Pⁱ; verify that
the result is a zero vector. It does involve writing custom matrix
multiplication and addition primitives to ensure that they are all computed
modulo the cardinal.

Unsurprisingly, the performance is not all that great:

    $ node test/perf
    10000 runs.
    base32check1: 243.500ms

There is a [neat trick][ffcomp] to speed up computation on a finite field where
the cardinal is a power of 2: instead of implementing vectors as arrays, use
integers whose binary sequence is the list of polynome coefficients. For
instance, 1+x² (which represents f) is `0b00101`, or 5.

Then **addition is XOR**, and matrix multiplication is a conditional XOR on the
successive bits of the current row. With aᵢ and bᵢ vectors of size 5:

    ⎛ a₀ ⎞   ⎛ b₀ ⎞   ⎛ Σ a₀[i]×bᵢ ⎞
    ⎜ a₁ ⎟   ⎜ b₁ ⎟   ⎜ Σ a₁[i]×bᵢ ⎟
    ⎜ a₂ ⎟ × ⎜ b₂ ⎟ = ⎜ Σ a₂[i]×bᵢ ⎟
    ⎜ a₃ ⎟   ⎜ b₃ ⎟   ⎜ Σ a₃[i]×bᵢ ⎟
    ⎝ a₄ ⎠   ⎝ b₄ ⎠   ⎝ Σ a₄[i]×bᵢ ⎠

It is 7× faster.

    $ node test/perf
    10000 runs.
    base32check1: 34.120ms

Now, how do you compute the check character?

First, compute S = Σ aᵢ·Pⁱ for the data you have.
Then, we need to solve S + c·P<sup>n+1</sup> = 0 for c.

Let's compute c·P<sup>n+1</sup> = -S.
Opposites are equal in GF(2ᵏ), so -S = S.

The second insight is that, since a primitive element is a generator of
its finite field, its powers loop around through all non-zero values. Therefore,
P<sup>2ᵏ-1</sup> = 1, and so, P<sup>n+1</sup>·P<sup>2ᵏ-n-2</sup> = 1.
This gives us the inverse of P<sup>n+1</sup>, which we can get by generating
all the powers of P when initializaing the system.

Then we have c = S·P<sup>2ᵏ-n-2</sup>.

<div id=base32check1Widget>
  <input class=input value=consecration>
  <strong><output class=validity>Valid</output></strong>
  (Add <strong><output class=checksum>A</output></strong> to be valid).
</div>

<script>
(function() {
// From https://github.com/espadrine/base32check/blob/master/1.js
const cardinal = 32;  // 2^5
const primitive = [  // From the 1+x²+x⁵ primitive polynomial.
  0b00001,
  0b10000,
  0b01001,
  0b00100,
  0b00010,
];

function matMul(a, b) {
  const width = 5;
  const height = a.length;
  const mat = new Array(height);
  for (let i = 0; i < height; i++) {
    mat[i] = 0;
    for (let j = 0; j < width; j++) {
      if ((a[i] & (1 << (width - j - 1))) !== 0) {
        mat[i] ^= b[j];
      }
    }
  }
  return mat;
}

function matCp(a) {
  let copy = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    copy[i] = a[i];
  }
  return copy;
}

const primitivePowers = (function genPowersOfPrimitive() {
  // Index 0 contains P^0 = I, 1 has P^1, … 30 has P^30.
  const powers = [ [], matCp(primitive) ];
  let p = powers[1];
  for (let i = 0; i < cardinal - 3; i++) {
    p = matMul(p, primitive);
    powers.push(p);
  }
  powers[0] = matMul(p, primitive);
  return powers;
})();

function fromBase32Char(c) {
  return c.charCodeAt(0) - (/[a-z]/.test(c)? 97: 24);
}

function toBase32Char(c) {
  c = +c;
  const d = (c > 25)? (c + 24): (c + 97);
  return String.fromCharCode(d);
}

function compute(payload) {
  payload = String(payload).toLowerCase();
  const n = payload.length;

  // We must solve Σ ai P^i = 0 for i from 1 to n+1.
  // First, compute Σ ai P^i for i from 1 to n.
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = fromBase32Char(payload[i]);
    sum ^= matMul([a], primitivePowers[(i+1) % (cardinal-1)])[0];
    //console.log(`a ${a}\texp ${i+1}\tsum ${sum}`);
  }

  // We must solve:  sum + code * primitive^(n+1) = 0
  // That is:        sum + opposite           = 0
  // Therefore:      opposite = -sum
  // In GF(2), matrices are their own opposites.
  const opposite = sum;

  // We must solve:  code * primitive^(n+1) = opposite
  // We know:        a^(cardinal-1) = 1
  // Therefore:      a * a^(cardinal-2) = 1
  // Here we have:   a = primitive^(n+1)
  // Hence:          code = opposite * primitive^((cardinal-2)*(n+1))
  let exp = (cardinal-n-2) % (cardinal - 1);
  exp = (exp < 0)? exp + cardinal: exp;
  const inverse = primitivePowers[exp];
  const code = matMul([opposite], inverse)[0];
  //console.log(`opposite ${opposite}\texp ${exp}\tinverse ${JSON.stringify(inverse)}\tcode ${code}`);
  return toBase32Char(code);
}

function validate(payload) {
  return compute(payload) === 'a';
}

function init() {
  const widget = document.getElementById('base32check1Widget');
  const input = widget.getElementsByClassName('input')[0];
  const validity = widget.getElementsByClassName('validity')[0];
  const checksum = widget.getElementsByClassName('checksum')[0];
  const updateWidget = () => {
    const value = input.value;
    validity.textContent = validate(value) ?  'Valid' : 'Invalid';
    const check = compute(value);
    checksum.textContent = (check !== check) ? 'removal of non-base32' : check;
  };
  input.addEventListener('input', updateWidget);
  updateWidget();
}
addEventListener('DOMContentLoaded', init);
})();
</script>

## base32check2

I chose to also design a 2-character checksum alongside, on the off-chance that
the first was not strong enough. There are 2<sup>2×5</sup> = 1024 possible
combinations of two characters of base32. Using the same design as above, it
required working on 10×10 matrices. I chose not to do that for the following
reasons:

- The initialization matrix starts to look scary like the Verhoeff one!
- There was opportunity for a design without matrices by instead picking a prime
  cardinal, which would enormously reduce implementation complexity.
- Using a prime instead of a prime power improves your multi-substitution
  detection. It doesn't matter for the 1-character checksum, because improving
  your 2-substitution score at the expense of your single-substitution score is
  a net loss.

So, I picked the largest prime below 1024, 1021, to limit the number of
sequences of two characters with the same value in GF(p). It does mean that
replacing any 75 by aa on even positions will give the same checksum, and the
same is true of 76 / ab and 77 / ac.

I brute-forced a primitive element, and again I took the largest, 1011, although
this time, there is no justification, just sheer superstition. (I tried
computing the statistics of detection of all primitives, and they seemed
equivalent.)

The computation of the check characters is identical. Since the matrices are now
1×1, all operations are scalar. Counter-intuitively, it is faster, although
still in the same ballpark as our optimized base32check1 design above:

    $ node test/perf
    10000 runs.
    base32check2: 23.701ms

<div id=base32check2Widget>
  <input class=input value=apotheosis>
  <strong><output class=validity>Valid</output></strong>
  (Add <strong><output class=checksum>AA</output></strong> to be valid).
</div>

<script>
(function() {
// From https://github.com/espadrine/base32check/blob/master/2.js
const cardinal = 1021;
// Primitive taken from bin/finite-field-primitive-elements 1021.
const primitive = 1011;
const primitivePowers = (function genPowersOfPrimitive() {
  const powers = [1, primitive];
  let p = primitive;
  for (let i = 0; i < cardinal - 3; i++) {
    p = (p * primitive) % cardinal;
    powers.push(p);
  }
  return powers;
})();

function fromBase32Char(c) {
  return c.charCodeAt(0) - (/[a-z]/.test(c)? 97: 24);
}

function toBase32Char(c) {
  c = +c;
  const d = (c > 25)? (c + 24): (c + 97);
  return String.fromCharCode(d);
}

function compute(payload) {
  payload = String(payload).toLowerCase();
  if (payload.length % 2 === 1) { payload = 'a' + payload; }
  const n = payload.length / 2;

  // We must solve Σ ai P^i = 0 for i from 1 to n+1.
  // First, compute Σ ai P^i for i from 1 to n.
  let sum = 0;
  let p = 1;
  for (let i = 0; i < n; i++) {
    const a = fromBase32Char(payload[2*i]) * 32 + fromBase32Char(payload[2*i+1]);
    // We could use primitivePowers here, although this may be faster.
    p = (p * primitive) % cardinal;
    sum = (sum + a * p) % cardinal;
    //console.log(`a ${a}\tp ${p}\tsum ${sum}`);
  }

  // We must solve:  sum + code * primitive^(n+1) = 0
  // That is:        sum + opposite           = 0
  // Therefore:      opposite = -sum
  const opposite = (sum === 0)? 0: (cardinal - sum);

  // We must solve:  code * primitive^(n+1) = opposite
  // We know:        a^(cardinal-1) = 1
  // Therefore:      a * a^(cardinal-2) = 1
  // Here we have:   a = primitive^(n+1)
  // Hence:          code = opposite * primitive^((cardinal-2)*(n+1))
  let exp = (cardinal-n-2) % (cardinal - 1);
  exp = (exp < 0)? exp + cardinal: exp;
  const inverse = primitivePowers[exp];
  const code = (opposite * inverse) % cardinal;
  //console.log(`opposite ${opposite}\tinverse ${inverse}\tp ${p}\tcode ${code}`);
  return toBase32Char(Math.floor(code / 32)) + toBase32Char(code % 32);
}

function validate(payload) {
  return compute(payload) === 'aa';
}

function init() {
  const widget = document.getElementById('base32check2Widget');
  const input = widget.getElementsByClassName('input')[0];
  const validity = widget.getElementsByClassName('validity')[0];
  const checksum = widget.getElementsByClassName('checksum')[0];
  const updateWidget = () => {
    const value = input.value;
    validity.textContent = validate(value) ?  'Valid' : 'Invalid';
    const check = compute(value);
    checksum.textContent = (check !== check) ? 'removal of non-base32' : check;
  };
  input.addEventListener('input', updateWidget);
  updateWidget();
}
addEventListener('DOMContentLoaded', init);
})();
</script>

The last question we may have is: how well does it compare?

## Results

<style>
th, td { text-align: "." center; }
</style>

<table>
  <tr><th> Error type   <th> Frequency <th> MOD 11-10 <th> MOD 97-10 <th> MOD 37-36 <th> MOD 1271-36 <th> base32check1 <th> base32check2
  <tr><td> 1sub         <td> 79.05%    <td> 7.6%      <td> 0.291%    <td> 0%        <td> 0%          <td> 0%           <td> 0%
  <tr><td> 0-trans      <td> 10.21%    <td> 9.503%    <td> 0.405%    <td> 0.195%    <td> 0%          <td> 0%           <td> 0%
  <tr><td> 0-2sub       <td> 1.92%     <td> 10.167%   <td> 1.084%    <td> 2.892%    <td> 0%          <td> 3.175%       <td> 0.025%
  <tr><td> 5sub         <td> 1.81%     <td> 10.083%   <td> 0.996%    <td> 2.769%    <td> 0.086%      <td> 3.101%       <td> 0.101%
  <tr><td> 3sub         <td> 1.4%      <td> 9.975%%   <td> 1.048%    <td> 2.714%    <td> 0.072%      <td> 3.087%       <td> 0.088%
  <tr><td> 6sub         <td> 1.34%     <td> 9.958%    <td> 1.013%    <td> 2.775%    <td> 0.074%      <td> 3.099%       <td> 0.099%
  <tr><td> 4sub         <td> 0.97%     <td> 10.042%   <td> 1.033%    <td> 2.737%    <td> 0.069%      <td> 3.133%       <td> 0.1%
  <tr><td> 1-trans      <td> 0.82%     <td> 11.689%   <td> 0.298%    <td> 1.931%    <td> 0%          <td> 0%           <td> 0%
  <tr><td> 2sub         <td> 0.81%     <td> 9.909%    <td> 0.971%    <td> 2.689%    <td> 0.05%       <td> 3.022%       <td> 0.055%
  <tr><td> 0-twin       <td> 0.55%     <td> 9.858%    <td> 0.351%    <td> 1.805%    <td> 0%          <td> 0%           <td> 0%
  <tr><td> phonetic     <td> 0.49%     <td> 11.199%   <td> 0%        <td> 11.055%   <td> 0%          <td> 0%           <td> 0%
  <tr><td> 1-2sub       <td> 0.36%     <td> 9.982%    <td> 1%        <td> 2.765%    <td> 0.04%       <td> 3.229%       <td> 0.208%
  <tr><td> 1-twin       <td> 0.29%     <td> 12.871%   <td> 0.331%    <td> 3.755%    <td> 0%          <td> 0%           <td> 0%
  <tr><th> Format       <td> N/A       <td> 1-digit   <td> 2-digit   <td> 1-alnum   <td> 2-alnum     <td> 1-base32     <td> 2-base32
  <tr><th>Detection rate<td> N/A       <td> 91.994%   <td> 99.629%   <td> 99.654%   <td> 99.995%     <td> 99.732%      <td> 99.993%
  <tr><th> Det. factor  <td> N/A       <td> 0.729     <td> 0.807     <td> 1.581     <td> 1.382       <td> 1.709        <td> 1.380
</table>

Error types:

- **`n`sub**: a sequence of `n` single-character substitutions, eg. `a..b` /
  `c..d` is a 2sub.
- **`m`-trans**: a single transposition between characters that have `m` other
  characters distancing them, eg. `a.c` / `c.a` is a 1-trans.
- **`m`-`n`sub**: a sequence of `n` single-character substitutions that have `m`
  other characters distancing them, eg. `a.b` / `c.d` is a 1-2sub.
- **`m`-twin**: two identical characters that are substituted to the same
  character, with `m` other characters distancing them, eg. `a.a` / `b.b` is
  a 1-twin.
- **phonetic**: `1a` / `a0` with a between 1 and 9, eg. thirteen / thirty.

The frequency column indicates how often a human makes a particular type of
error, based on [Verhoeff][]’s findings.

We use it to compute an approximate **detection rate**, relying on the
statistical proportion of random inputs for which the checksum does not
detect a given error type. You can see the proportion of undetected errors
for each checksum in the table above.

We added an interesting figure, the **detection factor**. After all,
we want our checksum to make the most of the space it takes. Each bit should
contribute to improving the detection rate. Since we expect a law of diminishing
returns for every additional bit, the detection rate of a given design should
improve with the number of checksum bits by 1 - 2<sup>-k·b</sup>, with b the
number of checksum bits, and k the detection factor, which we compute as
-log2(1-detection) ÷ b.

Each check digit is a base32 character, so they each cost 5 bits of
information, except for the alphanumerical ones, which cheat by producing
values that cannot be mapped to base32 characters without increasing the
error rate. Those take log2(36) ≈ 5.17 bits.

_(The detection factor is not a perfect model, as the [ISO/IEC 7064][]
algorithms don't all have the same factor, despite being the same design with
tweaked parameters. That said, MOD 1007-32 is between base32check2 and MOD
1271-36.)_

You will notice two positive things:

- Both base32check algorithms have a *similar or superior detection rate* than
  all others for a given number of check characters. (MOD 1271-36 is essentially
  identical, apart from the 0/O, 1/I and 8/B confusion risk, which is
  unfortunately not computed here, for lack of empirical data.)
- base32check1 has the *best overall detection factor*. base32check2 has a
  comparable one to MOD 1271-36. It is slightly lower, implying that it could
  potentially use its bits better. Indeed, there are a few tweaks that could
  help, although I would prefer to await more statistical human error data
  before changing the design, as the detection rate varies significantly if
  we label the 3sub thru 6sub as insertion and deletion errors instead, which
  they probably are; Verhoeff's study does not distinguish them.

While writing the algorithm, I worried that perhaps I would not be able to
beat the detection rate of IBAN with a single check character (half the
amount!). The whole point of designing base32check2 was on the off-chance
that it didn't. Fortunately, even base32check1 is better than IBAN's MOD
97-10, mostly thanks to IBAN's character conversion procedure.

## User Study

The computed scores depend on second-hand information from Verhoeff's study. It
may not map accurately to other alphabets, or alphabet sizes.

Moreover, it does not help determine which alphabet is least error-prone for
human transcription.

Down to the core, we want to minimize the number of times you send money to the
wrong account.

    prob_oops = 1 - prob_fine

    prob_fine =   Σ  prob_error·prob_detect_error + (1 - prob_error)
                error
                types

    prob_error = 1 - (1 - prob_char_error) ^ #chars

- `prob_error` is the probability that the human committed at least one error of
  that type over the whole text.
- `prob_char_error` is the probability of committing that type of error on a
  given character. It depends on the type of error, and `α`, the size of the
  alphabet used: the more symbols there are, the more they look alike.
- `prob_detect_error` is the probability that the error gets detected. It
  depends on the type of error. It is `1-prob_collision`, the probability that
  the checksum yields the same result for two inputs separated by an error of a
  give type.
- `#chars`: payload size. To transmit b bits of information, it is
  `⌈b ÷ log2(α)⌉ + checksum size`.

We can get the probability of a single-character substitution, for instance,
from the probability `p` of a substitution on a text holding `b` bits:

    prob_char_error = 1 - 2 ^ (log2(1 - p) ÷ ⌈b ÷ log2(α)⌉)

So, all we need, to find an optimal `α` and `checksum size`, is **a user study
estimating the probability of human mistakes**.

We will look at A = 7 alphabets:

- **base10** (digits) is found in most identifiers, including credit card
  numbers. Checksums include Luhn, MOD 11-10 and MOD 97-10,
- **base16** is found in most binary representations, including IPv6. A
  checksum for it is represented in [the paper we based our work on][Chen 2016],
- **base32** (our main focus),
- **base36**, seen in IBAN, has MOD 37-36 and MOD 1271-36,
- **base58** as used by Bitcoin addresses; we don't have a checksum for it, but
  one could be designed based on either MOD algorithms or [the paper's][Chen
  2016], although the latter would be more complicated, as it would use a
  combination of GF(2) and GF(29),
- **base64**, mostly to see how much base58 improves from it, can also easily
  have a checksum designed for it,
- **base1024**, a fresh design, used nowhere, where 10 bits are represented as 3
  alternating consonants and vowels, which means base32check2 would work just
  fine. It has roughly the same information density as base10, which makes it an
  interesting comparison. Would all base10 identifiers be better served by being
  shown as base1024 instead?

Let's ask each participant to submit S = 50 entries.
To get error estimations accurate to the percent, we need 100÷(S÷A) = 14
participants; we need ten times that to remove most of the estimation error.

All participant information is anonymous and sent securely.

Give it a try! Contribute to the study! Statistics will appear as you make
progress. Plus, it is pretty relaxing.

<!-- Taken from https://github.com/espadrine/checksum-user-study/blob/master/web/index.html -->
<form id=studyForm action='javascript:void 0'>
  <p><strong><output class=bitsOutput>Number</output></strong> bits of
     <strong><output class=alphabetOutput>alphabet</output></strong>
  <div class=expectedDiv>Loading…</div>
  <input name=studyInput>
  <div class=entryPromptNode>Enter the text you see above.</div>
  <div class=submissionPromptNode>Press Enter to submit this answer.</div>
  <div class=awaitEnoughSubmissionPromptNode>
    Once you submit 50 entries, the statistics across all participants will be
    included as well. You are at
    <strong><output class=countEntriesOutput>0</output> entries</strong>.
  </div>
</form>
<div id=showError></div>
<div id=alphabetStatistics></div>

<script>
(function() {

// The following is taken from https://github.com/espadrine/checksum-user-study/blob/master/model.js
const alphabets = {
  base10: `0123456789`,
  base16: `0123456789abcdef`,
  base32: `abcdefghijklmnopqrstuvwxyz234567`,
  base36: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ`,
  base58: `123456789ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`,
  base64: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`,
  // Imaginary; codes 10 bits in 3 characters (42% efficient)
  base1024: [...(function*() {for (const a of 'bdfghjklmnprstvz') for (const b of 'aeio') for (const c of 'bdfghjklmnprstvz') yield a+b+c; })()],
};

const alphabetNames = Object.keys(alphabets);

function symbolCountToEncode(bits, alphabet) {
  return Math.ceil(bits / Math.log2(alphabets[alphabet].length));
}

function stringSizeToEncode(bits, alphabet) {
  let count = symbolCountToEncode(bits, alphabet);
  if (alphabet === 'base1024') { count / 3; }
  return count;
}

function isValidAlphabet(a) {
  return alphabetNames.some(alphabet => alphabet === a);
}

// submissions: {<user>: Submission {
//   user, total: { <alphabet>: count },
//   errors: [TranscriptionError {
//     input, type,
//     test: Test { alphabet, bits, expected }
//   ]}}
// statistics: {<alphabet>: {total, outcomes: {<outcome>: {count}}}}
class Study {
  constructor(submissions = {}) {
    this.submissions = Object.fromEntries(
      Object.entries(submissions).map(([k, v]) => [k, new Submission(v)]));
    this.statistics = Object.create(null);
    this.buildStatistics();
  }

  add(submission) {
    if (this.submissions[submission.user] !== undefined) {
      this.revertStatistics(this.submissions[submission.user]);
    }
    this.updateStatistics(submission);
    this.submissions[submission.user] = new Submission(submission);
  }

  buildStatistics() {
    this.resetStatistics();
    Object.values(this.submissions).forEach(s => this.updateStatistics(s));
  }

  revertStatistics(submission) {
    this.updateStatistics(submission, -1);
  }

  updateStatistics(submission, diff = 1) {
    const errorTypes = submission.errors.reduce(
      (acc, e) => acc.add(e.type), new Set());
    const outcomes = ['no error', ...errorTypes];

    // Add new error types to statistics.
    for (const type of outcomes) {
      for (const [alphabet, stat] of Object.entries(this.statistics)) {
        if (stat.outcomes[type] === undefined) {
          stat.outcomes[type] = {count: 0};
        }
      }
    }

    // In order to compute the successful tests (with no errors), we need to
    // count the number of errors for each alphabet.
    const alphabetErrors = Object.fromEntries(alphabetNames.map(n => [n, 0]));

    // Update the error statistics.
    for (const error of submission.errors) {
      this.statistics[error.test.alphabet].outcomes[error.type].count += diff;
      alphabetErrors[error.test.alphabet]++;
    }

    for (const alphabet of alphabetNames) {
      this.statistics[alphabet].outcomes['no error'].count +=
        diff * (submission.total[alphabet] - alphabetErrors[alphabet]);
      this.statistics[alphabet].total += diff * submission.total[alphabet];
    }
  }

  resetStatistics() {
    this.statistics = Object.fromEntries(alphabetNames.map(
      a => [a, {total: 0, outcomes: Object.create(null)}]));
  }
}

class Submission {
  constructor(post) {
    if (!(post instanceof Object)) { post = Object.create(null); }
    this.user = post.user;
    this.total = Object.assign(Object.create(null), post.total);
    this.errors = (post.errors || [])
      .map(e => new TranscriptionError(e.input, e.test));
  }

  addEntry(input, test) {
    this.total[test.alphabet]++;
    if (test.expected !== input) {
      this.errors.push(new TranscriptionError(input, test));
    }
  }

  totalEntries() {
    return Object.values(this.total).reduce((a, e) => a + e);
  }

  validate() {
    let errors = [];
    if (typeof this.user !== 'string') {
      errors.push({code: 'invalid_type', message: 'user is not a string'});
    } else if (this.user.length < 20) {
      errors.push({code: 'invalid_type', message: 'user is not long enough'});
    } else if (this.user.length > 200) {
      errors.push({code: 'invalid_type', message: 'user is too long'});
    }
    if (!Object.keys(this.total).every(a => isValidAlphabet(a)
          && (typeof this.total[a] === 'number'))) {
      errors.push({code: 'invalid_type', message: 'total contains elements of the wrong format'});
    }
    const errorsValidation = this.errors.flatMap(e => e.validate());
    errors = errors.concat(errorsValidation);
    return errors;
  }
}

class TranscriptionError {
  constructor(input, test) {
    this.input = input;
    this.test = new Test(test);
    this.guessType();
  }

  guessType() {
    const lenDiff = this.test.expected.length - this.input.length;
    if (lenDiff > 0) {
      this.type = lenDiff + '-del';
      return;
    } else if (lenDiff < 0) {
      this.type = (-lenDiff) + '-ins';
      return;
    }
    const sub1 = findSub(this.test.expected, this.input);
    const trailSub = findSub(this.test.expected.slice(sub1 + 1), this.input.slice(sub1 + 1));
    if (trailSub !== undefined) {
      const sub2 = sub1 + 1 + trailSub;
      if (sub2 === sub1 + 1) {
        if (this.test.expected[sub1] === '1' && this.input[sub2] === '0' && this.test.expected[sub2] === this.input[sub1]) {
          this.type = 'phonetic';
          return;
        }
        if (this.test.expected[sub2] === '1' && this.input[sub1] === '0' && this.test.expected[sub1] === this.input[sub2]) {
          this.type = 'phonetic';
          return;
        }
      }
      if (this.test.expected[sub1] === this.input[sub2] && this.test.expected[sub2] === this.input[sub1]) {
        this.type = (sub2 - sub1 - 1) + '-trans';
        return;
      }
      if (this.test.expected[sub1] === this.test.expected[sub2] && this.input[sub1] === this.input[sub2]) {
        this.type = (sub2 - sub1 - 1) + '-twin';
        return;
      }
      if (this.test.expected.slice(sub2 + 1) === this.input.slice(sub2 + 1)) {
        this.type = (sub2 - sub1 - 1) + '-2sub';
        return;
      }
      this.type = 'nsub';
      return;
    }
    this.type = '1sub';
  }

  validate() {
    let errors = [];
    if (typeof this.input !== 'string') {
      errors.push({code: 'invalid_type', message: 'error input is not a string'});
    } else if (this.input.length > 200) {
      errors.push({code: 'invalid_type', message: 'error input is too long'});
    }
    errors = errors.concat(this.test.validate());
    return errors;
  }
}

function findSub(expected, input) {
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== input[i]) {
      return i;
    }
  }
}

function genChar(alphabet) {
  return alphabets[alphabet][Math.floor(Math.random() * alphabets[alphabet].length)];
}

function genPayload(size, alphabet) {
  let payload = '';
  for (let i = 0; i < size; i++) {
    payload += genChar(alphabet);
  }
  return payload;
}

class Test {
  constructor(test) {
    this.bits = test.bits || 64;
    this.alphabet = test.alphabet || 'base10';
    this.expected = test.expected || this.generate();
  }

  generate() {
    const size = symbolCountToEncode(this.bits, this.alphabet);
    this.expected = genPayload(size, this.alphabet);
    return this.expected;
  }

  validate() {
    const errors = [];
    if (typeof this.alphabet !== 'string') {
      errors.push({code: 'invalid_type', message: 'test alphabet is not a string'});
    } else if (!isValidAlphabet(this.alphabet)) {
      errors.push({code: 'invalid_type', message: 'test alphabet is unknown'});
    }
    if (typeof this.bits !== 'number') {
      errors.push({code: 'invalid_type', message: 'test bits are not a number'});
    }
    if (typeof this.expected !== 'string') {
      errors.push({code: 'invalid_type', message: 'expected test input is not a string'});
    } else if (this.expected.length > 200) {
      errors.push({code: 'invalid_type', message: 'expected test input is too long'});
    }
    if (errors.length > 0) { return errors; }
    const expectedSize = stringSizeToEncode(this.bits, this.alphabet);
    if (expectedSize !== this.expected.length) {
      errors.push({code: 'invalid_type', message: 'expected test input does not match alphabet and bits'});
    }
    return errors;
  }
}


  const submission = new Submission({
    user: '',
    total: Object.fromEntries(alphabetNames.map(n => [n, 0])),
    errors: [],
  });

  const submissionBatchSize = 50;

  class StudyForm {
    constructor(form) {
      this.form = form;
      this.input = this.form.studyInput;
      [ 'expectedDiv', 'bitsOutput', 'alphabetOutput', 'entryPromptNode',
        'submissionPromptNode', 'awaitEnoughSubmissionPromptNode',
        'countEntriesOutput' ]
      .forEach(className => {
        this[className] = this.form.getElementsByClassName(className)[0];
      });
      this.input.addEventListener('input', () => this.setInstructions());
      this.form.addEventListener('submit', () => this.submit());

      this.listeners = new Map();
      this.setInstructions();
    }

    prepareTest() {
      const alphabet = alphabetNames.reduce((acc, a) =>
        (submission.total[acc] < submission.total[a])? acc: a);
      this.test = new Test({alphabet});
      this.input.value = '';
      this.expectedDiv.textContent = this.test.expected;
      this.bitsOutput.value = this.test.bits;
      this.alphabetOutput.value = this.test.alphabet;
    }

    setInstructions() {
      if (this.input.value.length > 0) {
        this.entryPromptNode     .style.display = 'none';
        this.submissionPromptNode.style.display = 'block';
      } else {
        this.entryPromptNode     .style.display = 'block';
        this.submissionPromptNode.style.display = 'none';
      }

      const totalEntries = submission.totalEntries();
      if (totalEntries > 3 && totalEntries < submissionBatchSize) {
        this.countEntriesOutput.value = totalEntries;
        this.awaitEnoughSubmissionPromptNode.style.display = 'block';
      } else {
        this.awaitEnoughSubmissionPromptNode.style.display = 'none';
      }
    }

    submit() {
      if (this.test instanceof Test) {
        submission.addEntry(this.input.value, this.test);
      }
      this.emit('submit', { test: this.test, submission });
      this.prepareTest();
      this.setInstructions();
    }

    on(eventName, callback) {
      const callbacks = this.listeners.get(eventName) || [];
      this.listeners.set(eventName, callbacks.concat(callback));
    }

    emit(eventName, event) {
      (this.listeners.get(eventName) || []).forEach(l => l(event));
    }
  }

  class AlphabetStatistics {
    constructor(dom, {submission}) {
      this.dom = dom;
      this.data = this.data || {};
      this.data.study = new Study(
        Object.fromEntries([[submission.user, submission]]));
      this.data.overallStats = null;
    }

    update(submission) {
      this.data.study.add(submission);

      const totalEntries = submission.totalEntries();
      if (totalEntries >= submissionBatchSize) {
        downloadStudyStatistics().then(stats => {
          this.data.overallStats = stats;
          this.render();
        }).catch(e => { throw e });
      }

      this.render();
    }

    combinedStats() {
      // Poor folk's cloning. FIXME: do rich folk's cloning.
      const stats = JSON.parse(JSON.stringify(this.data.study.statistics));
      if (this.data.overallStats !== null) {
        for (const [alphabet, stat] of Object.entries(this.data.overallStats)) {
          stats[alphabet].total += stat.total;
          for (const [outcome, value] of Object.entries(stat.outcomes)) {
            stats[alphabet].outcomes[outcome].count += value.count;
          }
        }
      }
      return stats;
    }

    render() {
      const stats = this.combinedStats();
      const combineOutcomes = (acc, as) =>
        new Set([...acc, ...Object.keys(as.outcomes)]);
      const outcomes = [...Object.values(stats)
        .reduce(combineOutcomes, new Set())];

      const header = '<tr><th>Alphabets</th><th>'
        + outcomes.map(escapeHTML).join('<th>');
      const usedAlphabets = Object.keys(stats)
        .filter(a => stats[a].total > 0);
      const tableContent = '<tr>' + usedAlphabets.map(a => {
        const as = stats[a];
        const aos = outcomes.map(o => as.outcomes[o].count / as.total * 100);
        const cells = aos.map(i => `${i.toFixed(2)}%`);;
        return `<th>${escapeHTML(a)}<td>` + cells.map(escapeHTML).join('<td>');
      }).join('<tr>');

      this.dom.innerHTML = `<table>${header}${tableContent}</table>`;
    }
  }

  function escapeHTML(html) {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }


  function load() {
    loadUserStudy(submission);
    const studyForm = new StudyForm(document.getElementById('studyForm'));
    studyForm.prepareTest();
    const alphabetStatistics = new AlphabetStatistics(
      document.getElementById('alphabetStatistics'), {submission});
    if (alphabetNames.some(a => submission.total[a] > 0)) { alphabetStatistics.update(submission); }
    studyForm.on('submit', () => alphabetStatistics.update(submission));
    studyForm.on('submit', () => storeUserStudy(submission));
    studyForm.on('submit', () => sendUserStudy(submission));
  }
  addEventListener('DOMContentLoaded', load);


  // Persist user study submission.

  function storeUserStudy(submission) {
    localStorage.setItem(localStorageKey('submission'), JSON.stringify(submission));
  }

  function loadUserStudy(submission) {
    submission.user = getUser();
    try {
      const storedSubmission = JSON.parse(localStorage.getItem(localStorageKey('submission')));
      if (storedSubmission !== null) {
        submission.total = storedSubmission.total;
        submission.errors = storedSubmission.errors.map(e => new TranscriptionError(e.input, e.test));
      }
    } catch(e) { console.error(e); }
  }

  const localStoragePrefix = 'base32check_study_';
  function localStorageKey(key) { return localStoragePrefix + key; }
  function getUser() {
    const user = localStorage.getItem(localStorageKey('user'));
    if (user !== null) { return user; }
    const newUser = genPayload(22, 'base58');
    localStorage.setItem(localStorageKey('user'), newUser);
    return newUser;
  }

  const userStudyHost = (window.location.hostname === 'espadrine.github.io')
    ? 'https://thefiletree.com:58623'
    : window.location.origin;

  function sendUserStudy(submission) {
    fetch(userStudyHost + '/submissions', {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({submission}),
      headers: {'Content-Type': 'application/json'},
    })
    .catch(e => console.error('Failed sending base32check user study submission:', e));
  }

  function downloadStudyStatistics() {
    return fetch(userStudyHost + '/statistics', {mode: 'cors'})
      .then(res => res.json());
  }
}());
</script>

## References

- [base32check][] source code.
- [User study][] source code.

[Luhn]: https://patents.google.com/patent/US2950048
[Verhoeff]: https://onlinelibrary.wiley.com/doi/abs/10.1002/zamm.19710510323
[ISO/IEC 7064]: https://www.iso.org/standard/31531.html
[ISO 13616]: https://www.iso.org/standard/41031.html
[base58]: https://en.bitcoin.it/wiki/Base58Check_encoding#Background
[base64]: https://tools.ietf.org/html/rfc4648
[base32]: https://tools.ietf.org/html/rfc4648
[Chen 2016]: https://www.uni-due.de/imperia/md/content/dc/yanling_2015_check_digit.pdf
[fourwordsalluppercase]: https://www.youtube.com/watch?v=bLE7zsJk4AI
[primitive polynomial]: http://mathworld.wolfram.com/PrimitivePolynomial.html
[ffcomp]: https://johnkerl.org/doc/ffcomp.pdf
[base32check]: https://github.com/espadrine/base32check
[User study]: https://github.com/espadrine/checksum-user-study

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2019-04-29T14:18:51Z",
  "keywords": "hash" }
</script>