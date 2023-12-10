# Wordle Perfect Play with Generic Methods

Two years ago, the game of [Wordle][] was released.
I wrote [an article back then on finding good words to solve it][art1],
but I focused on implementing a good-enough algorithm,
which was a bit slow, and switched programming language
trying to tame its speed. I ended it saying: “Algorithms do matter too.”

It would be nice if, instead of language-specific tweaks,
we found an algorithm that made the runtime plummet
from half an hour to a second.

It would be nicer if we created an algorithm that achieved perfect play.

It would be even neater if that algorithm was so generic,
that it could solve a whole class of similar games.

[art1]: https://espadrine.github.io/blog/posts/sometimes-rewriting-in-another-language-works.html
[Wordle]: https://www.nytimes.com/games/wordle/index.html

## Faster approximations

Statistical

Entropic

## The Russian doll approach to optimization

Bellman optimality

MDP

MCTS

Multi-armed bandit

Lower bound

UCB w/ Hoeffding's inequality

But we want to compute the optimal prob from the optimal reward, not the current lower bound (which depends on visit count)

Thompson sampling

- Confidence bound
- Limiting to 100 choices

## Eulogy of the hyperparameters

Debiasing

Probability distribution of max of probability distributions

Monte-Carlo

Only look at top actions, and add one when the least is explored

## Reigning RAM in

Original wordlist: 7h

New wordlist: 40h

## A new entry in a large tent

AlphaGo

From policy network to action value estimates

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2023-12-09T22:19:02Z",
  "keywords": "ml, julia, optimization" }
</script>
