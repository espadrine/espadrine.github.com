# Markdown Quote Styling

![](https://78.media.tumblr.com/a9772210bc6152b53f050fc120bb41ae/tumblr_inline_o38eu6lCgM1qmhxug_540.png)

After four iterations, I am finally happy with the rendering I have for Markdown quotes.

_(You can see an example of one [in this example page](https://thefiletree.com/demo/markdown.md?plug=markdown). The CSS is [here](https://github.com/espadrine/plugs/blob/master/lib/css/markdown.css). If you don’t like reading, I made a [video](https://youtu.be/DNbhgWHPGbQ).)_

## Plain border

The most straightforward implementation is as a dumb **border on the left**.
> .markdown blockquote {
>  &nbsp;margin: 0;
>  &nbsp;padding-left: 1.4rem;
>  &nbsp;border-left: 4px solid #dadada;
> }

It swiftly provides a good approximation of what I wanted it to look like.
![](https://78.media.tumblr.com/1f55dc119962b11b386640fc478cdafb/tumblr_inline_o38eahxxeA1qmhxug_540.png)

However, the edges of that border are very sharp. How should we round them?

A border radius would only work on the left edges, not the right ones. We have to get creative.

## Bitmap border image

CSS provides a **border-image** property. Given an image that roughly pictures a square, it can map the top left part of the image to the top left edge of the border, the middle top part to the middle top border, and so on.

It is flexible enough that we can cheat: we can set it to map the whole picture to the left part of the border.
> border-style: solid;
> border-width: 2px 0 2px 4px;
> border-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAYAAABirU3bAAAAOklEQVQI103IQQ2AMBjF4G+/DPCEjiXYwdnTMEAGB3ZYkx7aluTA5edsSQa2OUYtAXvhWcZd6Hin/QOIPwzOiksIkAAAAABJRU5ErkJggg==) 2 0 2 4;

A disadvantage of that approach is that it forces us to have two pixels of invisible border at the top and at the bottom, corresponding to the two pixels of rounded corner in the image.

That, in turn, forces the paragraph’s margin inside of the blockquote (instead of collapsing with the previous paragraph’s margin), which requires adding a bit of code:
> .markdown blockquote :first-child {
>  &nbsp;margin-top: 0;
> }
> .markdown blockquote :last-child {
>  &nbsp;margin-bottom: 0;
> }

That is not overwhelming.

However, now, there is a bit of space at the top and at the bottom of the blockquote, for no good reason.
![](https://78.media.tumblr.com/a9772210bc6152b53f050fc120bb41ae/tumblr_inline_o38eujiA0N1qmhxug_540.png)

## Gradient border image

Instead of using a bitmap image, we can rely on a **radial gradient** to generate an ellipse. We can use the border-image parameters to cut almost all of the upper part of the ellipse so that it gets mapped to the top left corner of the border, and similarly for the bottom left, leaving a slim band at the center of the ellipse that will get stretched.
> border-image: radial-gradient(2px 50% ellipse at 2px 50%, #dadada, #dadada 98%, transparent) 45% 0 45% 4;

The disadvantage of this approach is that the rounded edge is pixelized, not antialiased.
![](https://78.media.tumblr.com/78c85ffaa29dbe70d11f3f72c24b3201/tumblr_inline_o38f4qQAKQ1qmhxug_540.png)

Besides, it doesn’t get rid of the top and bottom space.

We could, however, remove the top and bottom part of the border-image. Then, we would directly see the ellipse on the left.
> border-image: radial-gradient(2px 50% ellipse at 2px 50%, lightgray, lightgray 98%, transparent) 15% 0 15% 4;

However, the border would then look different (and stretched) depending on the height of the blockquote.
![](https://78.media.tumblr.com/340fb2f3fa239da867401b99d6741340/tumblr_inline_o38fb4Lskz1qmhxug_540.png)

## Before pseudo-element

One last hope is to rely on the ::before pseudo-element. We can style it as if it was a block, and make it float on the left.
> .markdown blockquote::before {
>  &nbsp;content: '';
>  &nbsp;display: block;
>  &nbsp;float: left;
>  &nbsp;width: 4px;
>  &nbsp;height: 4em;
>  &nbsp;margin-right: 1.2rem;
>  &nbsp;background: #dadada;
>  &nbsp;border-radius: 2px;
> }

However, we lose any height information. We cannot put a height of 100%, as that is still 0. We have no connection to the blockquote.

But it turns out we can force one to be created. All we need is a common trick: we force the blockquote (the parent element) to have a relative position, and force the ::before (the child) to have an absolute position.
> .markdown blockquote::before {
>  &nbsp;content: '';
>  &nbsp;position: absolute;
>  &nbsp;left: 0;
>  &nbsp;width: 4px;
>  &nbsp;height: 100%;
>  &nbsp;background: #dadada;
>  &nbsp;border-radius: 2px / 4px;
> }

Then, as if by magic, our 100% height matches our intention.
![](https://78.media.tumblr.com/e8e164a977693f69709b811436801730/tumblr_inline_o38flfLJbo1qmhxug_540.png)

As an aside, I was not completely satisfied by the 2 pixel border-radius, as it still looked a bit sharp. However, a 2px / 4px gave outstanding results.

In conclusion, with a bit of trickery, we can render markdown as nicely as we want, without changing the HTML produced by standard tools.

Here is the CSS file I now use:&nbsp;[https://github.com/espadrine/plugs/blob/master/lib/css/markdown.css](https://github.com/espadrine/plugs/blob/master/lib/css/markdown.css). A demo of that file is available here:&nbsp;[https://thefiletree.com/demo/markdown.md?plug=markdown](https://thefiletree.com/demo/markdown.md?plug=markdown).
