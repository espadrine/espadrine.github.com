set terminal svg size 800,480
set title '{/*1.2:Bold Training speed} (lower is better)'
set xlabel 'GPU-hours (h)'
set ylabel 'Training loss (cross-entropy)'
set datafile separator tab
set grid
model_sizes = "70B 34B 13B 7B"
line_colors = "#d62728 #2b9f2b #ff7f0e #1f77b3"
plot [] [1.45:2.2] for [i=1:4] \
  "data/llama2-".word(model_sizes, i).".tsv" using "Hours":"Loss" \
  with lines linewidth 2 linecolor rgb word(line_colors, i) title word(model_sizes, i)
