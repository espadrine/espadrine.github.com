set terminal svg size 800,480
set title '{/*1.2:Bold Training speed} (lower is better)'
set xlabel 'GPU-hours (h)'
set ylabel 'Training loss (cross-entropy)'
set datafile separator tab
set grid
model_sizes = "65B 33B 13B 7B"
line_colors = "#d62728 #2b9f2b #ff7f0e #1f77b3"
plot [0:1030000] [1.5:2.2] for [i=1:4] \
  "data/llama1-".word(model_sizes, i).".tsv" using "Hours":"Loss" \
  with lines linewidth 2 linecolor rgb word(line_colors, i) title word(model_sizes, i)
