# Recomputing ML GPU performance: AMD vs. NVIDIA

I am pretty impressed seeing [Lisa Su][] doing her best to steer the AMD ship towards
better AI support in GPUs, with the [Huggingface partnership][] and by convincing
George Hotz to submit more bug reports.

(For context, [Hotz raised $5M][] to improve RX 7900 XTX support and sell a $15K
prebuilt consumer computer that runs 65B-parameter LLMs. A plethora of driver
crashes later, he almost [gave up on AMD][].)

There’s quite a few issues to overcome, though.
While that GPU is great
([Stable Diffusion iteration speed per GPU cost][] is top-tier),
a cursory study would be flawed:
public GPU benchmarks like TechPowerUp, TomsHardware, etc. give:

- **RX 7900 XTX:** [123 TFLOPS][RX public perf]
- **RTX 4090:** [82.58 TFLOPS][RTX public perf]

Where do the figures come from?

While there is no official breakdown,
only [official figures][RX 7900 XTX specs], people widely compute it this way:

- For **NVIDIA**:
  [Boost Clock (THz) × CUDA Cores × 2][RTX 4090 specs]
  (since the FMA instruction does two floating-point operations
  (a multiplication and an addition) in 1 CUDA core cycle).
- For **AMD** on RDNA3:
  [Boost Frequency (THz) × Stream processors × 2 (dual issue) × 4 (dot product)][RX 7900 XTX specs],
  as [RDNA3 has `V_DUAL_DOT2ACC_F32_F16`][RDNA3],
  which does two dot products (a×b+c×d+e, 4 operations),
  in 1 processor cycle.

<table>
  <tr><th> Name </th><th> Price </th><th> Processors </th><th> Frequency </th><th> TFLOPS (FP16) </th><th> Perf/€ </th>
  <tr><td> <a href="https://www.amd.com/en/products/graphics/amd-radeon-rx-7900xtx">RX 7900 XTX</a> </td>
      <td> €1110 </td><td>  6144 </td><td>  2.5 GHz </td><td> 122.88 </td><td> 0.1107 </td>
  <tr><td> <a href="https://www.amd.com/en/products/graphics/amd-radeon-rx-7900xt">RX 7900 XT</a> </td>
      <td>  €942 </td><td>  5376 </td><td>  2.4 GHz </td><td> 103.22 </td><td> 0.1096 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_54756033603dff4c2_db18_46bd_9cc1_e7ad0debbbd0">RTX 4090</a> </td>
      <td> €1770 </td><td> 16384 </td><td> 2.52 GHz </td><td>  82.58 </td><td> 0.0467 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_44862952d932bba4_58ad_4ca4_a3d3_84a2295d2b85">RTX 3060</a> </td>
      <td>  €314 </td><td>  3584 </td><td> 1.78 GHz </td><td>  12.76 </td><td> 0.0405 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_44862952d932bba4_58ad_4ca4_a3d3_84a2295d2b85">RTX 3080</a> </td>
      <td>  €905 </td><td>  8704 </td><td> 1.71 GHz </td><td>  29.76 </td><td> 0.0329 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_44862952d932bba4_58ad_4ca4_a3d3_84a2295d2b85">RTX 3090</a> </td>
      <td> €1500 </td><td> 10496 </td><td> 1.70 GHz </td><td>  35.68 </td><td> 0.0238 </td>
</table>

That is an unjust comparison, though, because AMD’s instruction is more niche
than FMA (hitting this performance sweet spot is thus uncommon),
and because both of those GPUs have other tricks up their sleeves,
yielding superior FLOPS.

The [big one][Dettmers] on NVIDIA are [Tensor cores][].
With them, you can run an instruction that does
[a 4×4 to 4×8 matrix multiplication (page 25)][Ampere]
in 1 cycle within a single Tensor Core (32 CUDA cores).

2×4^2×8 (matmul ops) ÷ 1 (cycles) = 256 ops/TC/cycle.

(There is [some variation between NVIDIA GPUs][Ampere blog]
on which matrix sizes are supported and on how many cycles the instruction takes,
and NVIDIA keeps major aspects of their instruction set secret,
but on recent 30- and 40-series, this 256 number seems fairly constant.)

![Official image showing the matrix size for third-generation tensor cores with V100 FP32](https://www.nvidia.com/content/dam/en-zz/Solutions/gtcs22/tensor-cores/hopper-tensor-core-ampere-2c50-t.jpg)

That actually puts the RTX 4090 at
256 × 512 (Tensor Cores) × 2.52 (GHz)
÷ 1K (GHz per teracycle/s) = [330 TFLOPS in FP16][NVIDIA wiki]…
Much higher than the 123 TFLOPS that impressed Hotz on the RX 7900 XTX!

But AMD now has the same trick.
In [RDNA3][], with [WMMA][], the RX 7900 XTX has an instruction,
[`V_WMMA_F16_16X16X16_F16`][RDNA3]
that do two 16×16 matrix multiplications in [32 cycles][AMD cycles],
in a single Compute Unit (two sets of 32 threads).

2×16^3 (matmul ops) × 2 ÷ 32 (cycles) = 512 ops/CU/cycle.

This uses the same underlying silicon circuits as `V_DUAL_DOT2ACC_F32_F16`:
the architecture lays out the matrices in Vector General-Purpose Registers.
Each cell of the output matrix is computed by multiplying
one row from input matrix A with one column from input matrix B,
two input cells at a time
(two adjacent input A row cells packed inside the same VGPR,
and two adjacent input B column cells packed together inside another VGPR),
so they can be used by the packed dot product single-cycle instruction.
Within that same instruction, encoded in VOPQ
(a SIMD-like system to execute one operation
on an even register while it executes on an odd one at the same time),
an adjacent output cell also multiplies through its first two input cells
at the same time using dual issue.

The input row has size 16, so those two output cells are completed in 8 cycles.
Each two adjacent output cells in their diagonal
are computed with 16 parallel threads (on separate stream processors)
within the same 8 cycles.
We have done two diagonals (32 output cells); there are 14 diagonals left.
Inside that Compute Unit, we still have 16 stream processors that we can use;
they can handle two more output diagonals within the same 8 cycles.

Once our first four diagonals are computed,
we sequentially compute the next 4 diagonals in the next 8 cycles.
So forth for the next 4, and the last 4 after that.
In total, we have computed the matrix multiplication
in 32 cycles, which checks out.

Why can’t we do the matrix multiplication in 16 cycles
by using all 64 threads inside of the Compute Unit?
[Section 7.6 of the instruction set manual][RDNA3] indicates:

> [Dual issue] is legal only for wave32.

WMMA supports both wave32 and wave64, but it sounds like dual issue is
deactivated in wave64, and thus it would still take 32 cycles,
making it an ill-documentedly unfavorable proposition, I believe.

All in all, using [WMMA][], the RX 7900 XTX can crank through
512 × [96 (Compute Units) × 2.5 (GHz)][RX 7900 XTX specs]
÷ 1K (GHz per teracycle/s) = [123 TFLOPS in FP16][AMD wiki]…

That ends up being less than half the performance of the RTX 4090.
The superior number of operations per Compute Unit is offset by the
crushingly lower number of cores.
Perhaps the AMD strategy is to have the better circuit ready
before migrating to the TSMC N5 (“5 nm”) process at a less affordable price.

In practice, the lower performance is less of an issue for AI training,
because they are famously limited in the amount of parallelization opportunities
(even the best training runs typically incur only 50% GPU use at a given time).
The VRAM bandwidth then matters a lot for large models,
and the [RX 7900 XTX][RX 7900 XTX specs], despite using GDDR6 instead of GDDR6X,
has a higher bandwidth than the RTX 3090, thanks to its faster memory clock.
Still, it also is lower than the RTX 4090 on that front
(but at a lower price point).

<table>
  <tr><th> Name </th><th> Price </th><th> TFLOPS (FP16) </th><th> Memory bandwidth (GB/s)</th><th> Value (TFLOPS·GB/s/€) </th>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_54756033603dff4c2_db18_46bd_9cc1_e7ad0debbbd0">RTX 4090</a> </td>
      <td> €1770 </td><td> 330 </td><td> 1008 </td><td> 188 </td>
  <tr><td> <a href="https://www.amd.com/en/products/graphics/amd-radeon-rx-7900xtx">RX 7900 XTX</a> </td>
      <td> €1110 </td><td> 123 </td><td> 960 </td><td> 106 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_44862952d932bba4_58ad_4ca4_a3d3_84a2295d2b85">RTX 3080</a> </td>
      <td>  €905 </td><td> 119 </td><td> 760 </td><td> 100 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_44862952d932bba4_58ad_4ca4_a3d3_84a2295d2b85">RTX 3090</a> </td>
      <td> €1500 </td><td> 143 </td><td> 936 </td><td> 89 </td>
  <tr><td> <a href="https://www.amd.com/en/products/graphics/amd-radeon-rx-7900xt">RX 7900 XT</a> </td>
      <td>  €942 </td><td> 103 </td><td> 800 </td><td> 87 </td>
  <tr><td> <a href="https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_44862952d932bba4_58ad_4ca4_a3d3_84a2295d2b85">RTX 3060</a> </td>
      <td>  €314 </td><td> 51 </td><td> 360 </td><td> 58 </td>
</table>

Thus the RX 7900 XTX is not technically the best TFLOPS per price,
as was presumed in Hotz’s [raise announcement][Hotz raised $5M].
But that metric is not crucial for the purpose of making LLM machines,
and purely looking at hardware, that GPU is a fine choice for that,
in part because it has a fairer RAM per dollar offer,
so that it can hold a large model without needing pricier GPUS,
yet likely reaching reasonable inference speeds.

The other thorns on the side of AMD in AI, though, rear their ugly heads:
- [The compilers don’t produce great instructions][microbenchmark];
- The drivers crash frequently: ML workloads feel experimental;
- Software adoption is getting there,
  but kernels are less optimized within frameworks,
  in particular because of the fracture between ROCm and CUDA.
  When you are a developer and you need to write code twice,
  one version won’t be as good, and it is the one with less adoption;
- StackOverflow mindshare is lesser. Debugging problems is thus harder,
  as fewer people have encountered them.

(I will note, however, that the wealth of information provided by AMD
outshines that from NVIDIA tremendously,
even though they could better vulgarize those subtleties and
explain how to perform specific workloads like BERT training,
into which NVIDIA puts welcome care.
Just contrast [NVIDIA’s matmul page][NVIDIA GEMM] to [AMD’s][WMMA].
[AMD doesn’t even recognize its own flagship GPUs as supported for ROCm][ROCm support],
which is mindboggling coming from NVIDIA’s superior CUDA support.)

[Lisa Su]: https://twitter.com/LisaSu/status/1669848494637735936
[Huggingface partnership]: https://huggingface.co/blog/huggingface-and-amd
[Hotz raised $5M]: https://geohot.github.io//blog/jekyll/update/2023/05/24/the-tiny-corp-raised-5M.html
[gave up on AMD]: https://github.com/RadeonOpenCompute/ROCm/issues/2198#issuecomment-1574383483
[Stable Diffusion iteration speed per GPU cost]: https://www.tomshardware.com/news/stable-diffusion-gpu-benchmarks
[RX public perf]: https://www.techpowerup.com/gpu-specs/geforce-rtx-4090.c3889
[RTX public perf]: https://www.tomshardware.com/reviews/amd-radeon-rx-7900-xtx-and-xt-review-shooting-for-the-top
[RTX 4090 specs]: https://www.nvidia.com/en-us/geforce/graphics-cards/compare/#sectionenhanced_copy_54756033603dff4c2_db18_46bd_9cc1_e7ad0debbbd0
[RX 7900 XTX specs]: https://www.amd.com/en/products/graphics/amd-radeon-rx-7900xtx
[RDNA3]: https://www.amd.com/system/files/TechDocs/rdna3-shader-instruction-set-architecture-feb-2023_0.pdf
[Dettmers]: https://timdettmers.com/2023/01/30/which-gpu-for-deep-learning/#Will_AMD_GPUs_ROCm_ever_catch_up_with_NVIDIA_GPUs_CUDA
[Tensor Cores]: https://www.nvidia.com/en-us/data-center/tensor-cores/
[Ampere]: https://www.nvidia.com/content/PDF/nvidia-ampere-ga-102-gpu-architecture-whitepaper-v2.pdf
[Ampere blog]: https://developer.nvidia.com/blog/nvidia-ampere-architecture-in-depth/
[NVIDIA wiki]: https://en.wikipedia.org/wiki/GeForce_40_series#Desktop
[WMMA]: https://gpuopen.com/learn/wmma_on_rdna3/
[AMD cycles]: https://github.com/RadeonOpenCompute/amd_matrix_instruction_calculator/blob/339d784e56e55752495192b0781ea162fc32e323/matrix_calculator.py#LL1139C26-L1139C26
[ROCm support]: https://rocm.docs.amd.com/en/latest/release/gpu_os_support.html
[NVIDIA GEMM]: https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html
[AMD wiki]: https://en.wikipedia.org/wiki/RDNA_3#Desktop
[microbenchmark]: https://chipsandcheese.com/2023/01/07/microbenchmarking-amds-rdna-3-graphics-architecture/

---

[Comments on Reddit](https://www.reddit.com/r/espadrine/comments/156bbmj/recomputing_gpu_performance/).

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2023-06-18T21:40:09Z",
  "keywords": "gpu, ml" }
</script>
