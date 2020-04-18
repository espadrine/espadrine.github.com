set terminal svg
set title '{/*1.2:Bold PRNG Speed} (lower is better)'
set xtics nomirror rotate offset 1.3,0 scale 0
set grid ytics
set ylabel 'Speed (cpb)'
set datafile separator tab
set style data histograms
set style fill solid
set boxwidth 2 absolute
plot [] [0:] "<cat -" using 2:xtic(1) fc '#8888ff' lw 0 title ''
