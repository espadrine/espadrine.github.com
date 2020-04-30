all: speed-partial.svg speed.svg speed-total.svg

speed-partial.svg: speed-partial.tsv speed-partial.plot
	gnuplot speed-partial.plot >$@ <$<

speed.svg: speed.tsv speed.plot
	gnuplot speed.plot >$@ <$<

speed-total.svg: speed-total.tsv speed-total.plot
	gnuplot speed-total.plot >$@ <$<

.PHONY: all
