#!/bin/bash
LOG_DIR="$HOME/optimal-wordle/log/"
ESTIMATOR_LOGS="entropic-probabilist
avg-probabilist"
UCB_LOGS="hoeffding
laplace
puct"

# Preparations.
mkdir -p ./data/

# Data generation.
echo "$ESTIMATOR_LOGS" | (while read log; do
  ofile="./data/upper-bound-$log.tsv"
  echo "Iterations	Guesses" > "$ofile"
  echo "0	3158.0" >> "$ofile"
  < "$LOG_DIR/thompson-new-wordlist-$log" grep -Eo '^Step [0-9]+: We suggest ..... [^>]+' | awk '{print(substr($2, 1, length($2)-1), "\t", $6)}' >> "$ofile"
done)
echo "$UCB_LOGS" | (while read log; do
  ofile="./data/upper-bound-$log.tsv"
  echo "Iterations	Guesses" > "$ofile"
  echo "0	3158.0" >> "$ofile"
  < "$LOG_DIR/ucb-$log-new-wordlist-lower-bound" grep -Eo '^Step [0-9]+: We suggest ..... [^>]+' | awk '{print(substr($2, 1, length($2)-1), "\t", $6)}' >> "$ofile"
done)


# Plot generation.
gnuplot estimator.plot >estimator.svg
gnuplot ucb.plot >ucb.svg
gnuplot action-picker.plot >action-picker.svg
