# TheFileTree Design Log 4: Accounts

I mentionned needing to add accounts in [design log 2][]. It is [now implemented][authentication].

[design log 2]: ./thefiletree-design-log-2.html
[authentication]: https://github.com/garden/tree/commit/04a03786d81733aeca35b1ac4fe5b95c57d0e706

You go to `/app/account/`, which contains either your account information if you are logged in, or a form to get registered.

![Create an Account](https://i.imgur.com/rlfES3K.png)

![Congratulations for signing up](https://i.imgur.com/5oZdUdH.png)

You get an email with a link back to the website, which gives you a httpOnly secure cookie with a token that the database will recognize and associate to a JSON blob containing your information (email, user name).

![Email with link](https://i.imgur.com/mWxce40.png)

![Welcome page](https://i.imgur.com/bNBGooa.png)

![Account page](https://i.imgur.com/Pw4thNV.png)

As planned, I use email-login, which I improved for this purpose by adding support for [CockroachDB][], a serializable distributed SQL database that I plan on using more (maybe for file metadata).

[CockroachDB]: https://www.cockroachlabs.com/

All files [now][ACL] have an Access Control List (ACL) so that you can set the default access (none (404), reader, writer (can see and edit), owner (can also change the metadata, and therefore the ACL).

[ACL]: https://github.com/garden/tree/commit/6fbe24c41dfa7085533a6a0157daefc5a28ed7a4

![Folder ownership](https://i.imgur.com/2lROKuf.png)

ACLs on folders apply to all subfiles unless an explicit ACL overrides it. It works like variable scoping: the nearest containing metafolder with an explicit ACL that applies to you determines your access.

It works by setting the `acl` JSON object in the metadata. It is a map from username to right: `-` for none, `r` for reader, `w` for writer, `x` for owner.  Does it remind you of Unix permissions?

![JSON metadata](https://i.imgur.com/c04V9J9.png)

The `*` key is for other users (logged in or anonymous).

## Canop Finishing Touches

Code and bugs are lovers. The monster that I am had to crush a handful of the latter, but it really was to save the former.

For instance, **undo/redo** was semantically wrong.

Why? Of course, CodeMirror supports undo/redo, but it keeps track of all changes. However, when you are editing code with others, you only want to undo *your own changes*. If you wrote a word and press *Undo*, you expect your word to be removed, not the operations that someone else did in the meantime.

That required [managing my own undo stack][]

[managing my own undo stack]: https://github.com/espadrine/canop/commit/ed07dc80f8da61da15dee0703893315b1f863ba6

Another tricky situation arose while testing when I started using **multiple cursors**, a feature that every text editor under the sun stole from [SublimeText][] (although Wikipedia [mentions][simultaneous editing] MIT’s [LAPIS][] as the first to sport it, as part of their academic paper.)

[SublimeText]: https://www.sublimetext.com/docs/2/multiple_selection_with_the_keyboard.html
[simultaneous editing]: https://en.wikipedia.org/wiki/Simultaneous_editing
[LAPIS]: https://en.wikipedia.org/wiki/Simultaneous_editing

I received the editing operations CodeMirror gave me from the `change` events after it had already updated the editor. The operation positions I dealt with could not easily be mapped back to indices, as they related to the editor’s state before the change.

I tried getting inspiration from [ot.js][], but ended up relying on a [simpler algorithm using the `beforeChange` event][].

[ot.js]: https://github.com/Operational-Transformation/ot.js/blob/8873b7e28e83f9adbf6c3a28ec639c9151a838ae/lib/codemirror-adapter.js#L55
[simpler algorithm using the `beforeChange` event]: https://github.com/espadrine/canop/commit/1bc109bfc6b075b1a59d4e2401f902edfdf8288a

It does have the downside that you don’t automatically have multiple changes that are semantically combined (like deleting multiple selections). Those end up having a single undo entry, for instance. I was getting used to reimplementing CodeMirror things, so naturally I implemented a [time-based operation grouping system][].

[time-based operation grouping system]: https://github.com/espadrine/canop/commit/7beec5d1b8e231e0a52c6402931d5db77c2491da

## Deploying To Production

The first version of TheFileTree was located on a server under our college
dormroom desks; the second in a college server; the third on a friend’s
subletting server offer; the fourth on an OVH VPS. This one will be on Google
Cloud, starting with their free tier, where it should fit for some time before
it, hopefully starts generating revenue to be self-sustaining.

It did require some subtle tweaking to support the fact that sending emails is
severely restricted on Google Cloud. There is a handful of partners that you
have to go through; I picked MailJet. I tweaked the `email-login` npm package
and my DNS zone file to make it work.

As far as administrator interfaces are concerned, Google Cloud is extremely
polished, offering a clean interface with good configuration, and even a
convenient remote SSH-in-a-tab.

While it is still slightly slower to get up and running with a fresh instance
than on Digital Ocean, it is a step up from OVH. That said, OVH offers a
predictable fixed cost and no egress cost, while GCP will have complicated costs
to manage once I need to look after them.

Sadly, to get on the free tier, I was required to host the servers in South
Carolina, US. There is a subtle bit more latency as a result from France.

All in all, it was a very interesting choice to have. The website is now much
more robust than it was before. The only dark spot is the single-node
CockroachDB server, which dies on a regular basis, seemingly because it does not
like to be alone. I will have to investigate further later.

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2018-03-01T23:19:58Z",
  "keywords": "tree" }
</script>
