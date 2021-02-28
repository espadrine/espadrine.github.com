// Compute the mean range and its extrema for a Normal (Gaussian) distribution.
//
// This code depends on https://github.com/cag/mp-wasm.

// Compute the range of a normal distribution.
// In other words, the max an min of the set of likely (≥ `prob`) values
// among `samples` real-valued numbers
// taken from a Gaussian random variable.
// The Gaussian distribution’s parameters are its `mean` and `variance`.
function normalRange(mean, variance, samples, prob = .5, mpf = this.mpf) {
  const m = mpf(mean);
  const s2 = mpf(variance);
  const g = mpf(prob);
  const pi = mpf.getPi();

  const halfRange = mpf.sqrt(
    mpf(-2).mul(s2).mul(mpf.log(
      mpf.sqrt(mpf(2).mul(s2).mul(pi))
      .mul(mpf(1).sub(mpf.pow(
        mpf(1).sub(g), mpf(1).div(mpf(samples))))))));
  const min = m.sub(halfRange);
  const max = m.add(halfRange);
  const range = halfRange.mul(2);

  return { min, max, range };
}
