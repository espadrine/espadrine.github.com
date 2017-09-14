# Rich Web Editors

Here is what I wish to see in a rich Web editor.

## Features

First, **formatting**. At this point, I feel we all agree that there are two major types of formatting currently in use: block and inline. Here are all the corresponding formatting options a light editor should offer, by order of importance.

*   Block
  * Paragraph
  * Six heading levels
  * Lists (ordered and unordered, with nesting)
  * Embedded resource (image, audio, video, iframe?)
  * Blockquote
  * Horizontal ruler
  * Code block (optional: could be implemented as a paragraph with code and line breaks)
*   Inline
  * Italic
  * Bold
  * Link
  * Code
  * Line break
  * Strikethrough

Second, **toolbars** are the bane of my existence. User interfaces should be as clean as they can afford to be. All I should see when editing text is the text I write and a discreet button on the side to click when I am done editing.

The **editor** should not be a tiny window surrounded by bells and whistles. Ideally, all you should see is your text. If you are editing markup, you should see a live rendering of what you are typing on the side, centered on the equivalent location that your cursor is at.

Most importantly, editing is a **linear process**. It must be possible to specify what we want to write in the order in which we think it. For instance, if I know that the next word is italic, I ought to set italic _before_ I actually write the word. Being forced to first type text, then format it, requires me to keep in mind all the formatting I want as I write, in order to enforce it later. Writing already demands that I strain my memory into preparing what I will write later; no need to strain it further. This is what most makes me enjoy Markdown editing: typing a star, for example, naturally occurs before typing the italic word.

Finally, **performance**: there should never be a moment when we can type faster than text appears on the screen.

Nice-to-haves:

1. Automatic conversion of text to the right codepoint (such as quotes `"` to `“` and `--` to `—`), although you ought to be able to undo that.
2. Choosing the flow of blocks, between:
   * Normal
   * Centered
   * Half-width; text flows on the right
   * Half-width; text flows on the left
3. Tables, as a new block type.
4. Checklist, as a new block type (which Slack provides).

## Solutions

Formatting options should only appear in **contextual modeless popup**. That means it should not force you out of your editing experience. Typing should dismiss the popup. In total, all we need are three distinct popups:

1. Inline formatting
2. Block formatting
3. Embedding

While editing, there is no need for any popup. **When selecting text**, that popup has three purposes: contextually indicate that you can format that text inline, provide buttons to do so, and hint at the ability to do so in linear editing by providing the shortcuts.

* `Ctrl+I` → Italic
* `Ctrl+B` → Bold
* `Ctrl+K` → Link (Medium, Tumblr, Slack, Google Docs, Word)
* `Ctrl+Shift+K` → Code (Slack)
* `Shift+Enter` → Line break
* `Ctrl+Shift+X` → Strikethrough (Slack)
* `Alt+Shift+5` → Strikethrough (Google Docs)
* `Ctrl+Shift+6` → Strikethrough (Tumblr)

**When creating a new block**, a different popup should appear, giving you the option to select the block type (along with hinting at keyboard shortcuts). By default, a block should be a paragraph.

Changing the type of an existing block is obvious in hindsight. We are used to double-click to select a word, and to triple-click to select a block. Just like the double-click, the **triple-click** should also show the block formatting popup.

(I thought I was the only one to figure that idea out. To some extent, I am. Medium does rely on triple-click to hide one button: the drop cap.)

Unlike the inline formatting popup, the block one features exclusive options. We can therefore omit the current one, reducing the number of buttons.

Similarly, when embedding a resource, the resource type can be inferred from the link, which avoids unnecessarily asking what its type is. In fact, a resource embedding-specific popup can appear **whenever we paste a URL**, suggesting either to produce a link, or to embed its target. Ideally, pasting or dropping documents from the desktop should also be supported, and that does not require a popup, as the type can be inferred.

Because the block popup appears upon creating a new block, it is not as critical to having a linear editing process. Shortcuts are therefore optional. However, the following can ease the most common operations.

* `Ctrl+Alt+0` → Paragraph (Google Docs)
* `Ctrl+Alt+1` to `6` → Heading (Google Docs, Word, ~Medium, ~Slack)
* `Ctrl+Shift+2` → Heading (Tumblr)
* `Ctrl+Shift+7` → Ordered list (Google Docs, Slack, Tumblr)
* `Ctrl+Shift+8` → Unordered list (Google Docs, Slack, Tumblr)
* `Tab`, `Shift+Tab` → Increase / decrease nesting in lists
* `Ctrl+]`, `Ctrl+[` → Same as above (when Tab needs to be used)
* `Ctrl+Shift+9` → Blockquote (Tumblr)
* `Ctrl+Alt+K` → Code block (Slack)
* `Ctrl+R` → Horizontal ruler (Stack Overflow)

However, a much greater idea in my opinion is to have **Markdown-like automatic conversion**. It is not a novel idea (Slack did it first, and ProseMirror followed suit).

* `#+Space` → Heading (the number of # determines the header level)
* `*+Space`, `-+Space` → Unordered list
* `1.+Space` → Ordered list
* `>+Space` → Blockquote
* ```` ```+Space ```` → Code block
* `----` → Horizontal ruler
* `![]` → Embedded resource (not part of Slack, but would it not be fancy?)
* `:emoji:` → Emoji (based on the name). A nice-to-have, most certainly.

General shortcuts that ought to be supported as well:

* `Ctrl+C`, `Ctrl+X`, `Ctrl+V`: copy, cut, paste
* `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`: undo, redo
* `Ctrl+Backspace`: delete previous word
* `Ctrl+Delete`: delete next word
* `Ctrl+Home`, `Ctrl+End`: go to the start / end of the whole document
* `Ctrl+F`, `Ctrl+G`: find, find next occurrence
* `Ctrl+S`: if there is no auto-saving, this should save the document
* `Ctrl+/`: show shortcuts (Medium, Slack)

## What I have used

I will only point out what is wrong or missed in each implementation.

* [Blogger][]
  * Ugly toolbar
  * Too many formatting options: inline background color for text, inline font change, font size and text justification!
* [Wikipedia][]
  * Ugly toolbar
  * Not WYSIWYG, with an impenetrable syntax
  * No live preview
* [Reddit][]
  * Not WYSIWYG, and a custom Markdown that is not CommonMark
  * No live preview
  * Only images can be embedded
* [Stack Overflow][]
  * Ugly toolbar
  * Only images can be embedded
* [Tumblr][]
  * The editor is a tiny window in the middle of the screen, with the full app (updating blogs) running in the background — and you can see it by transparency!
  * Single-level heading
  * Illogical separation between block and inline formatting (the block formatter doesn't include block quotes or headings: those are in the inline formatter)
  * Automatic conversion of quotes, but no way to undo that conversion.
  * Audio cannot be embedded
  * Markdown mode: Should use CommonMark (ideally with tables added)
  * Markdown mode: No selection of formatting options appear when selecting text
  * Markdown mode: Only images can be embedded
  * Markdown mode: Only 1-level nesting (guess how I learned that?)
* [Slack][]
  * Slow and Buggy: on Firefox at least, the cursor frequently breaks, appears at two places, …
  * 3-level heading
* [Medium][]
  * 3-level heading
  * Illogical separation between block and inline formatting (the block formatter doesn't include block quotes or headings: those are in the inline formatter)
  * Automatic conversion of quotes, but no way to undo that conversion
  * Audio cannot be embedded

I'd rather not include [ProseMirror][] here yet, as it is a beta product. It fares fairly well, although I'd rather not have inline formatting options in the block formatting options (they are present to be used for linear editing (switch to italic before writing the italic word), but the keyboard shortcut is not hinted at). Besides, the always-present hamburger icon used for block formatting could be thrown away. Finally, nested lists are very awkward at the moment (neither tab nor `Ctrl+]` works, for instance).

The biggest issue facing ProseMirror, however, is the fact that *it does not have a block-level resource embedding object*. Images are only inline. It is convenient to enable emojis, I suppose, but definitely not for most publications. Most images in rich text are a block element, usually centered, sometimes with text flowing on the left or on the right. Almost never is having text aligned with the bottom of the image desirable.

[Blogger]: https://www.blogger.com
[Wikipedia]: https://www.wikipedia.org/
[Reddit]: https://www.reddit.com/
[Stack Overflow]: https://stackoverflow.com/
[Tumblr]: https://www.tumblr.com/
[Slack]: https://slack.com/
[Medium]: https://medium.com/
[ProseMirror]: http://prosemirror.net/

What other improvements would you like to see in user experience?
