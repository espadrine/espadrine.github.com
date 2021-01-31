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

Consider a distribution with probability density function $`\phi`.
Its associated random variable, $`X`, can be either real-valued or discrete.

We observe a sample of $`N` independent values taken from that distribution.

The question we ask is:
What is the range of values that have a probability ≥ $`\gamma`
(across samplings of N values) of appearing in the sample?
For instance, for a mean range, one would pick $`\gamma = \frac{1}{2}`.

Despite being potentially continuous, we can research the probability
that a given value appears at least once in the sample.
That is $`1 - P_{excluded}`, where $`P_{excluded}` is the probability
that the value does not appear in the sample.

In turn, given that the sample is independently drawn each time,
the probability that a value is not drawn once,
is $`P_{excluded} = (1 - \phi(x))^N`.

Thus, the probability that a given value is in the sample,
is $`1 - (1 - \phi(x))^N`.
By definition, that probability is equal to $`\gamma`.

We can therefore derive that the values $`x` that are in range,
follow the equation:

```latex
\phi(x) \geq 1 - \sqrt[N]{1 - \gamma}
```

When $`\phi` is a bell curve distribution,
the corresponding equality has two solutions for $`x`.

## 2. Application to the Normal

Some bell distributions are more easily invertible.
Thankfully, *this is true of the Normal distribution*,
which will enable us to produce good estimations for all distributions,
thanks to the **central limit theorem**.

First, let us derive the exact Normal solution.
We have $`\phi(x) = \mathcal{N}(\mu, \sigma^2)`:

```latex
\phi(x) = \frac{e^{-\frac{(x-\mu)^2}{2\sigma^2}}}{\sqrt{2\sigma^2\pi}}
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

## 4. Balls Into Bins

## Conclusion


<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2021-01-13T19:21:50Z",
  "keywords": "stats, crypto" }
</script>
