# Mean Range of Bell Curve Distributions

**Abstract:**
When sampling several data points from a known statistical distribution,
a valuable indication of the spread is the range of the set of values obtained.
Since the sampling is probabilistic,
the best estimate we can hope for is the expected value of the range.
That mean range,
along with the expected maximum and minimum values of the sampling set,
are traditionally difficult to compute with existing means.
We present a novel method to perform that computation,
and its implications on the correct computation of the balls-into-bins problem.

## 1. Generic Derivation

Consider a distribution with probability density function $`\varphi`.
Its associated random variable, $`X`, can be either real-valued or discrete.

We observe a sample of $`N` independent values taken from that distribution.

The question we ask is:
What is the range of values that have a probability ≥ $`\gamma`
(across samplings of $`N` values) of appearing in the sample?
For instance, for a mean range, one would pick $`\gamma = \frac{1}{2}`.

Despite being potentially continuous, we can research the probability
that a given value appears at least once in the sample.
That is $`1 - P_{excluded}`, where $`P_{excluded}` is the probability
that the value does not appear in the sample.

In turn, given that the sample is independently drawn each time,
the probability that a value is not drawn once,
is $`P_{excluded} = (1 - \varphi(x))^N`.

Thus, the probability that a given value is in the sample,
is $`1 - (1 - \varphi(x))^N`.
By definition, that probability is equal to $`\gamma`.

We can therefore derive that the values $`x` that are in range,
follow the equation:

```latex
\varphi(x) \geq 1 - \sqrt[N]{1 - \gamma}
```

When $`\varphi` is a bell curve distribution,
the corresponding equality has two solutions for $`x`.

## 2. Application to the Normal

Some bell distributions are more easily invertible.
Thankfully, *this is true of the Normal distribution*,
which will enable us to produce good estimations for all distributions,
thanks to the **central limit theorem**.

First, let us derive the exact Normal solution.
We have $`\varphi(x) = \mathcal{N}(\mu, \sigma^2)`:

```latex
\varphi(x) = \frac{e^{-\frac{(x-\mu)^2}{2\sigma^2}}}{\sqrt{2\sigma^2\pi}}
```

Thus the solution to the general inequality is:

```latex
x \in \left[
  \mu \pm \sqrt{-2\sigma^2
    \ln(\sqrt{2\sigma^2\pi}(1-\sqrt[N]{1-\gamma}))}
\right]
```

From this, we can compute the maximum and minimum exactly,
along with the mean range, which follows this formula:

```latex
2\sqrt{-2\sigma^2 \ln(\sqrt{2\sigma^2\pi}(1-\sqrt[N]{1-\gamma}))}
```

## 3. Application to the Binomial

The PDF of a binomial distribution $`\varphi(x) = \mathcal{B}(m, p)`,
the probability of a number $`x` of positive events
among $`m` events with probability $`p` of positivity,
follows this equation:

```latex
\varphi(x) = {m \choose x} p^x (1-p)^{m-x}
```

While $`x` is a discrete integer,
the distribution of $`\varphi` is also is bell-shaped.
Thus the generic derivation above can also be applied.

Two issues arise when using that derivation, however:

- Unlike the Normal, the binomial coefficient cannot be elegantly **inverted**,
  which prevents us from producing an exact formula.
- For large values of $`m - x` (around $`2^{128}`),
  calculating that binomial coefficient exactly
  is **too computationally expensive** to yield a result within a lifetime.

We can however devise an algorithmic method
by which we obtain an exact answer regardless.

The first issue can be solved by computing $`\varphi(x)` for all values of $`x`
until the bell curve plummets back below $`1-\sqrt[N]{1-\gamma}`.
However, that method is impractical when $`x_{max}` is too large.

Instead of going through each value of $`x`,
our algorithm can search for the right value
through increasingly accurate approximations,
similar to the way Newton’s method works.

This convergence works by:

1. Using the best model we have of the distribution,
2. Gathering information from the estimated root,
3. Updating the model to be even more precise,
4. Iterating, similar to an interpolation search,
   until eventually, we find two consecutive integers
   $`x_{max}` and $`x_{max}+1` where the first is above the limit
   (obtained from the generic derivation),
   and the other is not.

The two challenges in implementing this algorithm are:

- Problem 1: Evaluating $`\varphi(x)` is too expensive for large $`x`
  using integer arithmetic operations,
- Problem 2: Establishing a good and computable model for the distribution,
  and updating it in such a way that ensures eventual and fast convergence.

### 3.1. Evaluating the PDF

We use the classic solution:
first, convert the binomial coefficient formula to use the Gamma function.

```latex
\varphi(x) = \frac{\Gamma(m+1)}{\Gamma(x+1)\Gamma(m-x+1)} p^x (1-p)^{m-x}
```

Then, to avoid handling large gamma results,
we rely on an exact computation of the log-gamma.
We can use an arbitrary-precision library
to ensure we get an error below the integer result we end up with.
(To find the right precision to set for the algorithm,
we can rely on exponential binary search.)

```latex
\varphi(x) = e^{
  \ln\Gamma(m+1) - \ln\Gamma(x+1) - \ln\Gamma(m-x+1)
  + x \ln(p) + (m-x) \ln(1-p)
}
```

### 3.2. Converging to the range extrema

<script src="../assets/mean-range-of-a-bell-curve-distribution/mp-wasm.js"></script>
<script src="../assets/mean-range-of-a-bell-curve-distribution/normal-mean-range.js"></script>
<script src="../assets/mean-range-of-a-bell-curve-distribution/binomial-mean-range.js"></script>
<script>
fetchMPWasm('../assets/mean-range-of-a-bell-curve-distribution/mp.wasm')
.then(mpWasm => {
  const mpf = this.mpf = mpWasm.mpf;
  mpf.setDefaultPrec(256);
  const two256 = mpf(2).pow(256);
  const two128 = mpf(2).pow(128);
  const twom128 = mpf(2).pow(-128);
  const res128 = binomialRange(two128, twom128, two128);
  console.log(`min ${res128.min}`);
  console.log(`max ${res128.max}`);
  console.log(`range ${res128.range}`);
  const res256 = binomialRange(two256, twom128, two256);
  //console.log(`B(4,.5)(2) = ${binomialProb(2, 4, .5)}`);
  console.log(`min ${res256.min}`);
  console.log(`max ${res256.max}`);
  console.log(`range ${res256.range}`);
  //debugger;
});
</script>

## 4. Balls Into Bins

## Conclusion


<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2021-01-13T19:21:50Z",
  "keywords": "stats, crypto" }
</script>
