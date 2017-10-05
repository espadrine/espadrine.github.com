# What I Made In 2016

This year, the company I work for, Captain Train, was purchased by its English counterpart, Trainline. I added support for American Express BTA lodged cards, upgraded the SNCF integration to support their new fare systems, and worked on the common format for carriers.

In open-source, I made the following.

- A natural-language-processing bot library [queread][], in order to power [travelbot][], a CLI and Slack bot system which you can ask for travel information across Europe. It uses [travel-scrapper][], which relies on the Trainline websites for data.
- A multiplayer musical editor on top of TheFileTree, as a flexible textual editor. See [this example][musical editor].
- [Email-Login][] is now robust and ready to use.
- [Spash][], a [geohash][]-inspired Spacetime locator.
- The [json-diff][] gem offers a brand-new algorithm for diffing JSON content, with support for in-array object move operations as a first-class citizen, unlike existing LCS-based approaches, resulting in better output. I even published a [blog post][] on Trainline's blog.
- The [json-api-vanilla][] gem parses [JSONAPI][] payloads (ie. JSON with references, to support object graphs with reference cycles, etc.) and converts it to vanilla Ruby objects, with references correctly hooked up, without *any class definition needed*, unlike what existed before that.
- The [Canop protocol][] was finalized and implemented. [This commit][canop rebase] in particular finally implemented proper index shifting for intention preservation, so that people can edit the same text file simultaneously without losing their changes.
- The [json-sync][] project sprung out of the Canop effort. Unlike Canop, it cannot yet perform intention preservation. However, its design supports peer-to-peer networks, unlike Canop which is centralized.

I took greater concern in explaining my projects. People wouldn't understand the schematics for the first automobile, but a simple demonstration is enough to blow everybody's mind.

[Previously][].

[queread]: https://github.com/espadrine/queread
[travelbot]: https://github.com/espadrine/travelbot
[travel-scrapper]: https://github.com/espadrine/travel-scrapper
[musical editor]: https://thefiletree.com/david/audio/test.abc
[Email-Login]: https://github.com/espadrine/email-login
[Spash]: https://espadrine.github.io/spash/
[geohash]: https://en.wikipedia.org/wiki/Geohash
[json-diff]: https://github.com/espadrine/json-diff
[JSONAPI]: http://jsonapi.org/
[json-api-vanilla]: https://github.com/espadrine/json-api-vanilla
[json-sync]: https://github.com/espadrine/json-sync
[Canop protocol]: https://github.com/espadrine/canop/blob/master/doc/protocol.md
[canop rebase]: https://github.com/espadrine/canop/commit/b0f37b2cc789513e9c8bd1986e113bed6580328f
[blog post]: https://engineering.thetrainline.com/2016/10/05/how-we-switched-without-a-hitch-to-a-new-api/
[Previously]: http://espadrine.tumblr.com/post/138229350686/what-i-did-in-2015
