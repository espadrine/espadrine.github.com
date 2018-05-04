# Canvas Tricks

I work on a 4X-style game called Not My Territory (Yet) as a hobby. There are opposing teams with colors attributed to them. They own territory, and therefore have borders.

However, making borders look good on the map was always a bit of a challenge.

I wanted them to feel old-school.

I didn't want them to look geometrical.

And I needed them to be discrete, so as not to obstruct the view.

![Another example](http://upload.wikimedia.org/wikipedia/commons/6/61/Arrowsmith_Oregon_Country.jpg)

----

First, the shape was blocky, because it is the easiest thing to do with hexes:

![Block shape](http://i.imgur.com/ytaVdbp.png)

Then I smoothed it out with splines, but even that was too regular.

![Splined shape](http://i.imgur.com/h7omS7w.png)

I added irregularities, which was tricky, since a small change in the border (say, a tile added to it) must not change the shape of the rest of the border.

![Irregular shapes](http://i.imgur.com/vVGbIwg.png)

I used the algorithm to generate irregularities to draw how far a unit can move in one turn, as well.

Before:

![Move distance](http://i.imgur.com/PaqZAU6.png)

After:

![Move distance with irregularities](http://i.imgur.com/2lIEd3d.png)

(Out of curiosity, here's what the un-splined version looks like, the irregularities are very apparent: I nudge one vertex out of two.)

![Shape with random irregularities but no splines](http://i.imgur.com/9FjF3oo.png)

----

Next, the border color. After a [Reddit poll][] where I presented [fairly](http://i.imgur.com/t5JH8ma.png) [different](http://i.imgur.com/a6yHLqG.png) [options](http://i.imgur.com/8t5PLL8.png), I settled on this:

![Border color appearance](http://i.imgur.com/HXbAeXu.png)

The tricky bit, this time, is to ensure that borders don't overlap when two nations are right next to each other. To achieve this result, I use canvas clipping, drawing only the inside of the border, after having drawn a full border for each opposing camp. Chrome pixelates the edge of clipped painted data, probably because of its Path implementation, but that's the best solution I found.

Also, yet again, I ensured that dashed borders didn't change with a small change in the border.

Before:

![Dashed border before single cell addition](http://i.imgur.com/0YLd1E3.png)

→

![Dashed border after single cell addition](http://i.imgur.com/2HAV00k.png)

After:

![Dashed border before single cell addition](http://i.imgur.com/UH17gHd.png)

→

![Dashed border after single cell addition; most of the border stayed pixel-identical](http://i.imgur.com/Qhrk8Ez.png)

That was done by putting a dash one out of two consecutive hexagonal edge along the border.

[Reddit poll]: http://www.reddit.com/r/gamedev/comments/2avffd/4x_which_country_border_is_most_pleasing/

----

What next? I found the map's shoreline (and all terrain transitions) too harsh and geometric as well.

![Shoreline with blunt transition from grass to water](http://i.imgur.com/z96DxlM.png)

I tried to use the same trick as before, irregular splines, but it doesn't work this time.

![Smooth shoreline with blunt transition](http://i.imgur.com/u4JKYmU.png)

I accidentally found out that making my sprite images square gave a surprisingly good random shoreline.

![Irregular shoreline with blunt transition, made from random rotations of the
square sprite images](http://i.imgur.com/IlnRUIn.png)

I added some noisy irregularities to the sprite sheet.

![Irregular shoreline with noisy transition](http://i.imgur.com/BzXY7WU.png)

I added a beach tile in the sprites, and the result is a lot better!

![Shoreline with beach to transition from grass to water](http://i.imgur.com/AYbB515.png)

Before:

![Before all shoreline changes](http://i.imgur.com/z96DxlM.png)

After:

![After all shoreline changes](http://i.imgur.com/AYbB515.png)

----

Finally, while it was cool to have [a map the size of a cosmic superbubble](https://www.youtube.com/watch?v=BFSW2FgWQR0), having a game where your enemy can infinitely escape isn't fun. I enclose each new map in a random continent the size of Corsica.

![Map of a large island from high above](http://i.imgur.com/gIuPSQD.png)

----

Did I say "finally"? This is the last item! I improved the look of the map when unzoomed.

Before:

![Zoomed out map of the island with strange color choices and pixelated hexagonal cells](http://i.imgur.com/XST4jt6.png)

More recently:

![Zoomed out smooth island with strange color choices](http://i.imgur.com/Ta3FcuU.png)

Now:

![Zoomed out smooth island with plausible color choices](http://i.imgur.com/GCcRJ7e.png)

Bonus picture, 3D rendering, a fair bit of work with many challenges to come:

![Shoreline with mountains casting shadows](http://i.imgur.com/uhyBlTN.png)

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2014-10-05T22:41:00Z",
  "keywords": "game, canvas" }
</script>
