// Compute the mean range and its extrema for a Binomial distribution.
//
// This code depends on https://github.com/cag/mp-wasm.

// Compute the range of a binomial distribution.
// In other words, the max and min of the set of likely (≥ `prob`) values
// of the number of positive events among `events` independent attempts
// that go positive with probability `posprob`,
// when that set is constituted of `samples` independently obtained numbers
// (of positive events among `event` attempts).
function binomialRange(events, posprob, samples, prob = .5, mpf = this.mpf) {
  const n = mpf(events);
  const p = mpf(posprob);
  const g = mpf(prob);
  const pi = mpf.getPi();
  if (p.isNaN() || !p.isFinite()) {
    return { min: 0, max: 0, range: 0, iterations: 0 };
  }
  const targetProb = mpf(1).sub(mpf(1).sub(g)
    .pow(mpf(1).div(mpf(samples))));
  let min, max;  // What we are searching for.

  // Track lower and upper bounds to the range.
  const mean = n.mul(p), variance = mean.mul(mpf(1).sub(p));
  let lowMax = mean;   // Must always be Pr(lowMax) > targetProb.
  let highMax = n;     // Pr(highMax) <= targetProb.
  let steps = 0;

  let approxMean = mean;
  for (;;) {
    steps++;
    let normal = normalRange(approxMean, variance, samples, prob, mpf);
    let curMax = normal.max.ceil();
    // Compute the actual probability at that estimation.
    let curProb = binomialProb(curMax, n, p, mpf);
    // Update the approximate mean
    // to get the normal curve to track the binomial one.
    approxMean = curMax.sub(mpf.sqrt(
      variance.mul(-2).mul(mpf.log(curProb.mul(
        mpf.sqrt(variance.mul(2).mul(pi)))))));
    // Check that we are not stuck on a value.
    if (curMax.lte(lowMax) || curMax.gte(highMax) || curMax.isNaN()) {
      // Use binary search instead.
      curMax = lowMax.div(2).add(highMax.div(2)).floor();
      curProb = binomialProb(curMax, n, p, mpf);
    }
    // Update the bounds.
    if (curProb.gt(targetProb)) {
      lowMax = curMax;
    } else {
      highMax = curMax;
    }
    if (highMax.sub(lowMax).lte(1)) {
      max = lowMax;
      break;
    }
  }

  // The binomial PMF is symmetric around the mean.
  min = mpf.max(0, mean.sub(max.sub(mean)).round());
  // Binary search: (2^128,2^-128,2^128): 128; (2^256,2^-128,2^256): 256
  // Newton method: (2^128,2^-128,2^128): 128; (2^256,2^-128,2^256): 256
  // Interp search: (2^128,2^-128,2^128): 8;   (2^256,2^-128,2^256): 8

  max = max.ceil();
  return { min, max, range: max.sub(min), iterations: steps };
}

// Compute the probability mass function of a binomial distribution B(n, p),
// at the point k.
// In other words, it is the probability of getting k positives,
// when running n independent trials that go positive with probability p.
function binomialProb(k, n, p, mpf = this.mpf) {
  k = mpf(k); n = mpf(n); p = mpf(p);
  const logFactors = mpf.lngamma(n.add(1))
    .sub(mpf.lngamma(k.add(1)))
    .sub(mpf.lngamma(n.sub(k).add(1)))
    .add(k.mul(mpf.log(p)))
    .add(n.sub(k).mul(mpf.log(mpf(1).sub(p))));
  return mpf.exp(logFactors);
}
