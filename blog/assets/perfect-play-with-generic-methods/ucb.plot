set terminal svg size 800,480
set title '{/*1.2:Bold Best strategy uncovered} (lower is better)'
set xlabel 'Iterations'
set ylabel 'Upper bound on average number of guesses per game'
set datafile separator tab
set grid
set logscale xy
plot [7:25000] [3:10] "data/upper-bound-hoeffding.tsv" \
    using "Iterations":"Guesses" \
    with lines linewidth 2 title "Hoeffding", \
  "data/upper-bound-puct.tsv" \
    using "Iterations":"Guesses" \
    with lines linewidth 2 title "PUCT", \
  "data/upper-bound-laplace.tsv" \
    using "Iterations":"Guesses" \
    with lines linewidth 2 title "Laplace",
