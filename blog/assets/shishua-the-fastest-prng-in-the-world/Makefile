all: speed-partial.svg speed.svg

speed-partial.svg: speed-partial.tsv speed-partial.plot
	gnuplot speed-partial.plot >$@ <$<

speed.svg: speed.tsv speed.plot
	gnuplot speed.plot >$@ <$<

.PHONY: all
