LLAMA1_DATA_PIXELS = data/llama1-7B-pixels.tsv data/llama1-13B-pixels.tsv data/llama1-33B-pixels.tsv data/llama1-65B-pixels.tsv
LLAMA1_DATA = data/llama1-7B.tsv data/llama1-13B.tsv data/llama1-33B.tsv data/llama1-65B.tsv
LLAMA2_DATA_PIXELS = data/llama2-7B-pixels.tsv data/llama2-13B-pixels.tsv data/llama2-34B-pixels.tsv data/llama2-70B-pixels.tsv
LLAMA2_DATA = data/llama2-7B.tsv data/llama2-13B.tsv data/llama2-34B.tsv data/llama2-70B.tsv

all: llama1-training-speed.svg llama2-training-speed.svg

llama1-training-speed.svg: llama1.plot $(LLAMA1_DATA)
	gnuplot llama1.plot >$@

llama2-training-speed.svg: llama2.plot $(LLAMA2_DATA)
	gnuplot llama2.plot >$@

$(LLAMA1_DATA) $(LLAMA2_DATA): llama-data.py $(LLAMA1_DATA_PIXELS) $(LLAMA2_DATA_PIXELS)
	python3 llama-data.py
