set terminal svg size 800,480
set title '{/*1.2:Bold Best strategy uncovered} (lower is better)'
set xlabel 'Iterations'
set ylabel 'Upper bound on average number of guesses per game'
set datafile separator tab
set grid
set logscale xy
plot [1:1000] [1:100] "data/upper-bound-avg-probabilist.tsv" \
    using "Iterations":"Guesses" \
    with lines linewidth 2 title "Statistical", \
  "data/upper-bound-entropic-probabilist.tsv" \
    using "Iterations":"Guesses" \
    with lines linewidth 2 title "Entropic"
