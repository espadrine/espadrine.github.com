# A History of Settings File Format, and dotset

The landscape for configuration formats is quite poor.

There is a lot of choice, but each pick has substantial flaws.
There is no fairer portrait than that which Wikipedia paints:

- The **INI** file format is a de facto standard for configuration files.
- **.properties** is a file extension for files mainly used in Java related technologies to store the configurable parameters of an application.
- **JSON** provides a syntax which is easier to parse than the one typically adopted for INI file formats, and also offers support for data types and data structures
- **YAML** is used by some for more complex configuration formats.
- **Plist** is the standard configurations file format for Cocoa Applications.

Let me go through them one by one.

                | comments | maps in lists | simplicity |
    ------------+----------+---------------+------------+
    .properties |    x     |               |     x      |
    INI         |    x     |               |     x      |
    Plist       |          |       x       |     x      |
    XML         |    x     |       x       |            |
    JSON        |          |       x       |     x      |
    TOML        |    x     |               |     x      |
    DotSet      |    x     |       x       |     x      |
    
    Comments, maps in lists, simplicity: pick two.

The INI file format is a simple way to store some information.
Did I mention it is simple? It is *very simple*.
You have a dictionary map at the top level, and in there, another map.
Each keys of that second map have string values.

Are the keys case-sensitive? Maybe. Does it have comments? Maybe, either hashed `#` or Lisp-like `;`. What is the delimiter between keys and values? I don't know, it's usually `=`, but sometimes `:`. See the problem? It is non-standard. Even if it was, you can't do much with it.
Limited data structures are limited.

DotProperties are even simpler than INI files, if you can believe it. (I cannot.) You are left with a single map from string keys to string values, and you have comments. On the plus side, it is pretty standard…

Plists used to be a [beautiful, lightweight format](https://developer.apple.com/library/mac/#documentation/Cocoa/Conceptual/PropertyLists/OldStylePlists/OldStylePLists.html#//apple_ref/doc/uid/20001012-BBCBDBJE): simple, easy to read, it has all the data structures of JSON, or close enough. It even has easy binary data as hexadecimal sequences, and dates! Truly, if Apple had worked to make it ubiquitous, JSON would never have been needed. It has all of its power, and all of its irritating things.

Yet, plist would have lost against INI. 
Why? Comments.
Comments actually serve as documentation.
A textual file is not just great because you can use your preferred text editor, it is great because you can *read* it.
Comments are not just for programming languages:
they have their place inside data, too.
Plist simply forgot to add comments.

Anyway, Apple killed the Plist format, replacing it with XML. The data structures are the same, but now the parsers need to be extra smart.
The addition of boilerplate made the files so big that Apple even added an equivalent binary format.
Too bad, the XML form is [here to stay](https://github.com/search?q=.plist).

On to XML, then. Why is it bad?

[So](http://harmful.cat-v.org/software/xml/) [many](http://c2.com/cgi/wiki?XmlIsTooComplex) [people](http://wiki.whatwg.org/wiki/Namespace_confusion) [have](http://lists.whatwg.org/pipermail/whatwg-whatwg.org/2008-August/015905.html) [eloquently](http://www.tbray.org/ongoing/When/200x/2003/12/13/MegaXML) [discussed](http://nothing-more.blogspot.ch/2004/10/loving-and-hating-xml-namespaces_21.html) [it](http://intertwingly.net/slides/2004/devcon/77.html). It boils down to this:

1. Starting on an XML-based project is usually a nightmare,
2. All by itself, XML is actually *more limited* than our old friend plist.
   It's just text, you have to build your own format on top of it,
   which in turn adds complexity and cruft and makes #1 worse!
3. Namespaces are unintuitive, hard to use, and make #1 and #2 even worse…

To support its complexity, XML has developed satellite sublanguages of its own to configure it: XPATH, SAX, XSLT, XSD, DTD…
Can XML data crash a browser or worse? [Of course it can](http://en.wikipedia.org/wiki/Billion_laughs). Is it Turing-complete? It can be…

In the end, it all boils down to one thing: it is too complex. It is hard to read, hard to parse, and because of draconian error handling, you'd better not have made a mistake. But remember, spotting a mistake is hard, better use a validator. Or an external GUI that will make the source ugly.
A wise man once said: "it combines the space-efficiency of text-based formats, and the readability of binary."

In a world dominated by XML, JSON was a gasp of fresh air.
Its syntax is minimal. It has all the data structures you look for. Writing a parser is a matter of a couple of hours; not that you need to. Reading it is easy too. Just like [asm.js](http://asmjs.org/), it fitted perfectly as a natural extension to the Web platform, because it was already there.

JSON gains ground. It has both a [lot](http://www.ietf.org/rfc/rfc4627.txt?number=4627) [of](https://npmjs.org/doc/json.html) [acceptance](https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-ux/firefox-21.0a1.en-US.linux-x86_64.json) and good press.

Yet, everything has bad parts, and JSON is no exception:

- It feels painfully draconian in its handling of errors for one simple reason: people forget to remove the trailing comma in `[1, 2, 3,]`
- It doesn't have comments, which makes it unsuitable for readable configuration.

Aware of those small annoyances, I had privately started to work on my own replacement.

Then, one drunk night, a week ago, Tom Preston-Werner, fed up as I was about the status quo, decided to take no more, and created TOML.

[TOML](https://github.com/mojombo/toml/) is meant to be solidly standardized, unlike INI. However, it is meant to be just as limited. It does have JSON arrays, and it thought to authorize trailing commas (which I like to believe I had something to do with).

I wrote about TOML's shortcomings [there](https://gist.github.com/espadrine/5028426), let me rewrite those here:

- The primary issue is that you can't have dictionary maps inside of arrays.
I see this pattern in many configuration files, from Sublime Text to server configuration. That is just sad. First-class maps are more useful than first-class dates.
- Having homogeneous arrays is an artificial restriction that doesn't actually serve a higher purpose. I believe the hope is that static languages will benefit from it. They won't.
- The way you edit the main dictionary map is quite limited itself. Keys need to be grouped in a strange, sometimes counter-intuitive way. I say that from the experience of trying to convert JSON settings file to TOML. Frustration.
- Even if the file is encoded in UTF-16, every string must be encoded in UTF-8 — I repeat, inside of a UTF-16 file. Text editors will love this, if the standard is applied to the letter.

In short, TOML isn't as good as the OpenStep plist format, but it has its niceties. And no, it didn't invent first-class Dates.

It felt unfortunate to see a new format fail to be greater than its historic predecessors.
They say history is repeated as farce first, then as tragedy; the plist switch to XML was the farce, switching from JSON to TOML would be tragedy.

As a response, I published [DotSet](https://github.com/espadrine/dotset), the Settings File Format I pioneered.

The data structures are so close to JSON that they are interchangeable. I [had fun](http://espadrine.github.com/dotset/) with that. [Really](http://espadrine.github.com/dotset/).

However, remember JSON's shortcomings that I mentioned above?
I erased them. I ended up with a language as pleasant to read as Python,
as easy to write as plain text, and very simple. Simpler than TOML, with more power. I made a `node` [parser / stringifier](https://npmjs.org/package/dotset) for it. It was easy. And fun.

----

And now, the crystal ball.

It seems to me like there are two future directions for configuration:

- JSON-compatible textual files acting as hierarchical databases lacking only the file system support that could bring the efficiency it deserves,
- Turing-complete programming languages: [node.js](http://nodejs.org/) servers are configured in JS (compare that with [Apache](http://httpd.apache.org/docs/2.4/configuring.html) configuration); [Guix](http://www.gnu.org/software/guix/) is a package manager whose configuration is all written in [Guile](http://www.gnu.org/software/guile/), the acclaimed [Scheme](http://scheme-reports.org/) interpreter / compiler. Those languages have in turn a subset for data literals that fit the above description of JSON-compatible data.

Funny thought: the [Lua](http://lua.org/) programming language was initially meant to be a configuration file format. Ha ha ha.

Ok, not *that* funny.

All this to end there: TOML doesn't fit in the picture. It will one day, but then, it will have the complexity of YAML and awkwardly combined features. You will need whiskey to ignore that.

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2013-03-05T13:03:00Z",
  "keywords": "" }
</script>
