# Noisy Background Image

For a long time, I have learned all the techniques to get a random background noise. Now that I believe I master them all and invented a new one, I feel like I can discuss the subject.

## Inserted PNG Image

The most obvious technique is to rely on Gimp (or Photoshop, or <insert your bitmap image doctoring progam>) to perform the image randomization.

![Create image](https://31.media.tumblr.com/523bb82392d8c333e41f71aa898f1d7b/tumblr_inline_nczepogDve1qmhxug.png)

To get raw random pixels, you can rely on Hurl noise:

![Hurl noise](https://31.media.tumblr.com/0cc96975b393845b33c9e6f636eb324b/tumblr_inline_nczeqbyFnu1qmhxug.png)

![Randomize](https://31.media.tumblr.com/cd370d6f4d89d13b1d84b7b73eee0df8/tumblr_inline_nczerxGF7T1qmhxug.png)

If you fancy smoother random transitions, Perlin noise does the job:

![Perlin noise](https://31.media.tumblr.com/44592240483eaa3e59168bf1f9408c0d/tumblr_inline_nczer4um2N1qmhxug.png)

![Randomize again](https://31.media.tumblr.com/eaa30a160ed17c28a8ce728a863093cc/tumblr_inline_nczes9Nlb81qmhxug.png)

You should play with the opacity slider in order to have something much more discreet.

Then, you need to include the image. You could of course just write this CSS code:

```
html {
  background: url(./img.png);
}
```

However, it is of better form to include it as base64 data. Having to wait for the browser to notice the image and start downloading it gives the appearance of a slow page load experience. Downloading everything on the go is better, even if base64 data is bigger than raw data, at least until the glorious days of HTTP 2.0 Push (where you'll be able to send the image alongside the web page in a single HTTP response cycle).

Here's a command that outputs your base64 data.

```
node -p 'fs = require("fs"); fs.writeFileSync("img.png.base64", fs.readFileSync("img.png", "base64"));'
```

Copy and paste the data here:

```
html {
  background: url(data:image/png;base64,iVBORw0KGgoAA…), black;
}
```

![](https://31.media.tumblr.com/78a9a9ecdbe5d8e90799c077805c28a5/tumblr_inline_ndcf0yDrcQ1qmhxug.png)

I wish I could link this image to a jsbin that shows the code, but the image data is too large for that. Incidentally, this is an excellent introduction to what comes next.

## Prime Numbers

Having a large image download is very sad. Fortunately, we can achieve a similar level of pixel noise with two or three small images. A single smaller image gives poor results:

![](https://31.media.tumblr.com/be0f58c9bd3e7e2c6f1def334e2ceb6c/tumblr_inline_ndcfaeaFO01qmhxug.png)

But relying on two or three square images whose width is a prime number guarantees that the pattern won't repeat for a very long time. Given two images of size MxM and NxN, with M and N prime numbers, the resulting image won't repeat until MxN. Let's try with M = 13 and N = 23. Then the repetition will only happen at 299. Add to that a 11x11 pixels image and you will get something of size 3289x3289 pixels.

Of course, that is only true of truly random data, which is definitely not the case of Gimp's Hurl, unfortunately. To achieve a better result with better compression, I use a baseline of grey `0x808080`, add an RGB noise (since I use a grayscale color profile, it only changes colors in shades of gray), and put the opacity somewhere close to 5%.

![](https://31.media.tumblr.com/ccadec989bdfa0453f36dd49910d2955/tumblr_inline_ndcl0tqAmT1qmhxug.png)

Here is what we get with 3 images of sizes 11, 13 and 23, all set at 5% opacity:

[![](https://31.media.tumblr.com/8669d610caa71c02bbeb929fc9e807cc/tumblr_inline_ndckv1MUBP1qmhxug.png)](http://jsbin.com/senaqu/1)

That webpage costs 1978 bytes, compared to 3969 bytes for a single image of 50x50 pixels generated using the same technique, with which repetition would be visible ([example here](http://jsbin.com/pepumo/1)).

Of course, this prime number trick only works for completely random background pixels. I was always dissatisfied that there was no way to have similarly small image downloads for background Perlin noise.

Until I found a way.

## SVG Filters

It turns out browsers already have the Perlin noise code in their SVG engines. All that is needed is to generate an SVG image at load time, and assign it to the background. The trick is to use the [Turbulence filter effect](http://www.w3.org/TR/SVG11/filters.html#feTurbulenceElement) with skill. I recommend combining it with a ColorMatrix filter.

    (function background() {
      var seed = (Math.random() * 1000)|0;
      var domHtml = document.documentElement;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + domHtml.clientWidth + '" height="' + domHtml.clientHeight + '"><filter id="a"><feturbulence basefrequency=".2" numoctaves="1" seed="' + seed + '"></feturbulence><fecolormatrix values="1 1 1 1 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 0.04"></fecolormatrix></filter><rect width="100%" height="100%" filter="url(#a)"></rect></svg>';
      domHtml.style.backgroundImage = 'url(data:image/svg+xml;base64,' + btoa(svg) + ')';
    }());

[![](https://31.media.tumblr.com/2254b3b5adc177e271fdbb76a9f5fe22/tumblr_inline_ndcmfiVzI41qmhxug.png)](http://jsbin.com/qihagu/1)

I tend to favor using JS to produce this effect, because this way, we can generate a unique seed on every page load. That said, it is entirely possible to put it in a data URL, as we have done before.

The [resulting page](http://jsbin.com/qihagu/1) costs a mere 912 bytes, far smaller than our previous experiments with PNG images. And that's with a random seed; it is even smaller (although, not by much, 736 bytes) when inserted directly in the CSS as base64 data.

Of course, the picture above is just an example. There are many more possibilities based on this technique. For instance, here, I use turbulence; I could go for fractal noise. Playing with the number of octaves at high level exposes IEEE-754 errors in the mandatory algorithm, which gives interesting dotted results…

![](https://31.media.tumblr.com/118c2ae294926513240f9f7e3b72ecd2/tumblr_inline_ndcn0fjpyi1qmhxug.png)

Using different base frequencies between the X and Y coordinates gives more surprises. We can further combine this with a rotation to get visible random diagonals. Of course we can also get raw random pixels, as we had before, using a very small base frequency (somewhere around 0.4). Experimenting with the Color Matrix can give stellar results as well, despite its scary appearance.

----

Here you go! Everything you needed to know about noisy background images, including the state-of-the-art in terms of small image download with perfect result.

I already started using this here (which the astute reader will surely have noticed), and on [Aulx](http://espadrine.github.io/aulx), the autocompletion engine for the Web which I'll continue improving in the future. </insert>

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2014-10-22T20:11:00Z",
  "keywords": "css svg" }
</script>
