# Multiline comments: do without

Lately, while working on my [autocompletion system](https://github.com/espadrine/aulx), I kept struggling with multiline comments.
Obviously, you don't want dot completion in a comment.
Then, I started wondering about how useful multiline comments are, at all.

There are three use-cases for multiline comments.

1. Normal comments,
2. Comment a block of code effortlessly,
3. Automated documentation (JavaDoc, JSDoc, etc.)

The point that I wish to make is that none of those make multiline comments relevant. Some even have inherent deficiencies and edge-cases.

Normal comments can always be managed by single-line comments.
It seems that you can always convert your multiline comments into single-line comments with no trouble at all. The reverse operation, converting single-line comments to multiline, is not always possible.

Commenting a block of code can also be handled by single-line comments. If it isn't just as effortless as using multiline comments, your text editor is lacking. It is hugely easy on Vi and Emacs, and on any good text editor.

- Vi: in visual mode, select the lines you want to comment. Press the colon key, and type the following command: `s,^,//,`. That command replaces the start of the line with a double slash.
- Emacs: select the lines you want to comment. Enter CTRL+X, R, T (in this order). At the prompt that appears, enter `//`. Double slashes appear at the start of each line.

Worse than that, multiline comments can fail. If the block of code contains a string, or a regex, that includes the closing sequence of characters (for instance, "*/"), then the comment stops there. You have no recourse. Furthermore, in most programming languages, multiline comments don't even nest: if your block of code has one, you can't comment it.

Finally, documentation. I see no reason why automatic documentation tools cannot deal with single-line comments. Furthermore, the mere idea that you are not allowed to write "*/" in your documentation is preposterous.

If you create a new language, please remember: adding multiline comments is a mistake.

If you use a language with multiline comments that rely on a closing sequence, avoid them like a disease.

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2013-02-04T20:22:00Z",
  "keywords": "js" }
</script>
