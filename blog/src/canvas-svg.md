# Canvas SVG

The other night, I was dreaming of colorful lines.

I was racing on this roller-coaster of red, green, blue pathways, occasionally jumping from one platform to the next. It felt like being part of this [acko.net](http://acko.net/) front page. I hurt myself quite a bit and, slowly and surely, ended up coloring everything in red. That's until I fell down into this bright light surrounding me, only to realize that space was circular; falling from the bottom made me land on the top. The sound of my knees breaking made me wake up.

## That is when I realized that an effort I had ongoing had a simple and elegant solution.

You may know that I made and maintain the <http://shields.io> service. An effort in providing badges for use in GitHub and elsewhere, this website promotes the use of SVG as a means to diminish bandwidth costs for images and solve the zoom / retina / [4x](http://fremycompany.com/BG/2013/Why-Super-Retina-screens-are-worthwhile-172/) / `<picture>` problem that so many web developers are losing hair on. You see, images are either photos, textures, or icons / banners / logos / badges / all this ilk.

- For photos: use JPEG / WebP with `<picture>` and store a 4x version of it.
- For textures: WebGL is your friend.
- For the rest: use SVG.

The neat outcome of this categorization is that, as we go towards an animated world where even newspaper pictures are [ambiance loops](http://www.nytimes.com/newsgraphics/2013/10/27/south-china-sea/) straight from a Harry Potter book, or [astonishing video interviews](http://www.theguardian.com/world/interactive/2013/nov/01/snowden-nsa-files-surveillance-revelations-decoded) that deliver immediate context to the article… with seamless looping scenes algorithms [already there](http://research.microsoft.com/en-us/um/people/hoppe/proj/videoloops/)… the progressive solutions are thankfully obvious.

- WebP becomes WebM. (*Please, web devs, take a page from [moot's book](http://blog.4chan.org/post/81896300203/webm-support-on-4chan) and no less than the great Vine service, don't use wasteful gifs or looping WebP!*)
- WebGL is already built for interactivity.
- SVG has animations, but, more importantly, it shares the same DOM that we can JSify.

## But I digress.

The issue that has itched me as I provided those badges was fonts. I could not freely choose them. Either bundling a font in the image would make it weigh *way too much*, or subsetting the font dynamically would take *way too much time*. The only thing I had was to hide behind **web-safe fonts**, and compute the probability that the badge would have just the right width, and the text would look just about right for users to have no idea.

I am serious, by the way, about computing the probabilities. Look at [this issue on GitHub](https://github.com/badges/gh-badges/issues/14). Scroll. Keep scrolling.

How can we get away from this? In general, how can we use many different fonts on many different images?

You may not have noticed this by looking at the <http://shields.io> website: [the logo](http://shields.io/logo.svg) is made of [OpenSans](http://en.wikipedia.org/wiki/Open_Sans) text. Whenever we can precompute a subsetted font, we should, and that is what I did: a font that contains only the letters S, h, i, e, l, d, s, I and O. No duplicate letters; this is a worst-case. The logo weighs 8.6KB, and it's all SVG.

How do you do it? Use SIL's [ttfsubset](http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=fontutils#fb138857) (it is brilliantly useful, despite its flawed installation process—I actually had a bit of a struggle to make it work [back in January](http://scripts.sil.org/svn-public/utilities/Font-TTF-scripts/trunk/Changes) but I fixed it).

    $ cat glyphs-logo
    S h i e l d s I O
    $ ttfsubset -n OpenSans -g glyphs-logo OpenSans.woff OpenSans-icon-subset.woff
    $ node -p 'var fs = require("fs"); fs.writeFileSync("OpenSans-icon-subset.woff.base64", fs.readFileSync("OpenSans-icon-subset.woff", "base64"));'

Nonetheless, as I said before, I cannot use this trick for all my badges, since the computation would be too expensive.

## The Age Of Batik

Another option was to target a specific font, convert it to SVG paths stored in one obese JSON, and compute the position of each letter with respect to each other. Every letter would then be a distinct SVG path, and our obese JSON would contain kerning information so that we can avoid designers having their eyes bleed.

There already exists a converter from TTF to SVG fonts called [Batik](http://xmlgraphics.apache.org/batik/tools/font-converter.html). We then could [parse](https://github.com/Leonidas-from-XIV/node-xml2js) the XML, extract all the path description attributes, compile them into JSON.

However, SVG fonts are a bit weird. The paths are upside-down, so that I'd have to parse each path, recompute all the dots by mirroring them along an axis I would have to find, and scale them to our intended font size.

Then, for every letter I type in, I would have to keep track of the horizontal position, look for the path description, subtract the kerning information, add a `<path>` element to the badge, move my horizontal ruler, and get ready for the next letter.

This process was sufficiently complicated that I got stuck between the mirroring computation and the storage of kerning information. It was taking more time than I wanted, as well.

## The Dawn Of Node-Canvas

Dawn? How poetic. Yet, it is true that I found a simpler solution while rising from a colorful dream along with a colorful sun, getting ready to go work on making it easier to [sell train tickets](https://www.capitainetrain.com/).

I was already using [**node-canvas**](https://github.com/Automattic/node-canvas). This server-side implementation of HTML's [Canvas API](http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#canvasrenderingcontext2d) helps me compute the width of a badge's text in a particular font, so that each badge is produced with the correct width.

I had in the past dabbled with [Cairo](http://cairographics.org/), the amazingly modular graphics engine used in Linux' Gnome environment, Mozilla's Firefox browser, WebKit's GTK+ port, Inkscape and Gnuplot. I won't admit that I first played with Cairo through [Why the Lucky Stiff's Shoes library](http://shoesrb.com/).

Cairo is also what powers node-canvas.

Cairo is splendid because it has a clear separation between **what** you want to draw and **where** you want to draw it. You only need to flip one code line to have something you draw be on the screen, on a PNG image, on a PDF…

… or on an SVG image.

All I needed was to [add the bindings](https://github.com/Automattic/node-canvas/pull/465) for it in node-canvas!

Suddenly, thanks to this patch, I can:

- Get SVG paths from text of a specific font (instead of resorting to web-safe fonts),
- Generate customized SVG images server-side, which saves more bandwidth the larger the image and doesn't have that zooming / retina / 2x / `<picture>` issue,
- Compute SVG images to be inserted in the middle of an HTML page, which makes it part of the DOM and can be animated by a nearby script.
Think of subtle animated random background images or pre-generated real-time graphs!

It isn't merged yet, but I am already excited!

## Afterword

This was going to be part of a talk I wanted to make at JSConf. Unfortunately, I was not selected as a speaker. There are many more things I wanted to cover — the history of those GitHub badges you see everywhere, the technology used to make each badge, to support both SVG, PNG and the like with exactly the same rendering, some nitty-gritty about caching and the story of our interaction with all those services we support… Maybe another blog post, another time?
