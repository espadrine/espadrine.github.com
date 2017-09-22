# JSON Diff With First-Class Move Operations

_(This was first posted [here](https://blog.trainline.fr/12389-algorithme-diff-json) in French and [there](https://engineering.thetrainline.com/2016/10/05/how-we-switched-without-a-hitch-to-a-new-api/) in English.)_

Back in January, here at Trainline Europe, we learnt that SNCF, the main French railway company, wanted to update their fare system — that is, the set of rules which determine their ticket prices. The plan was to scrap congestion pricing on TGVs (France’s high-speed trains), reduce sudden price increases, introduce so many offers to discount card owners that it would feel like Christmas!

However, those goals were not without challenges. Just as a princess must defeat a dragon to free her Prince Charming, SNCF had to fight the complexity of its current fare system to extract a pearl from its ashes. The blood from this fight had to drip onto their partners: counter agents, travel agencies, [GDS](https://en.wikipedia.org/wiki/Global_Distribution_System)es … and yours truly.
![](https://78.media.tumblr.com/57fb76ee4b004e708779d1432a3798aa/tumblr_inline_oflowvGtz81qmhxug_540.png)

_Fighting fare systems requires extensive equipment._

## A New Search API Is Born

Someone at Trainline Europe (formerly Captain Train) had to update our code to the new fare system, and I volunteered. It would be a large and sensitive project, as we had to port our SNCF search engine to use a different [API](https://en.wikipedia.org/wiki/Application_programming_interface). We taught a new language to our train search engine, in a way.

Detect changes between old and new results

This engine converts (carrier-specific) search results into an intermediate format for internal use, common to all carriers. The input to this conversion was about to change significantly, but the output needed to stay identical. Indeed, the new SNCF search API, to which we were about to connect, can offer both the old and the new fare system, up to the very day on which the new fare system would be released to the world.

After working on it for a while, we got the format conversion working. It was then time to ensure that nothing would change for our users. So I tweaked our train search engine to re-execute searches of a subset of our users in production, once the first, original search had been performed with the old engine. Once this was done, I saved the [JSON](https://en.wikipedia.org/wiki/JSON) output of the old and new engines side by side.

I now had a large quantity of “before / after” files, of which each pair was supposedly identical. Of course, those files were not literally identical. Would you expect fate to be so kind? They contained random keys here, newly ordered lists there, such that a trival `[diff](https://en.wikipedia.org/wiki/Diff)` of the files was out of the question.

Had a `diff` been possible, it would still not have helped me understand why the two files were different, since it only sees line changes, not structural ones. I needed a diff which was able to understand the structure of JSON. Each difference was a bug.

I went looking for such an algorithm, I hopped from library to program, all claiming they could diff me some JSON. What I found gave reasonable results, but they all suffered from tremendous false-positive flagging. In particular, they all broke their teeth against having JSON lists used as sets. Although the order of the items was irrelevant, it was flagged as a complex reconstruction of the list. None of these tools could tell that the order of the items in the list had merely been shuffled around.

Why?

## The Issue

How would you describe a change?

We could simply perform a bitwise comparison and declare: “Hello! Nothing has changed!” or “Everything is different!” Of course, our analytical abilities are then tiny. Imagine a gargantuan database in which a single insignificant integer is incremented. If your diff is only able to tell, “Remove the whole database, and recreate a brand new one that happens to be nearly identical”, your diff is much too fat. Additionally, you remove the intention hiding behind the change.

In JSON, most values cannot be nested; let’s call them atoms. For most uses, having a diff that uses a trivial comparison for atoms is fine. On the other hand, it needs to walk through the structures to be of any use. Objects are fine: unless you want to detect key renames, you simply compare values key-for-key. (For most uses, key renames are irrelevant.)

Trouble starts with arrays. We could compare their values index-for-index — that is what [jsondiff](https://github.com/francois2metz/jsondiff) does, but unlike the other sacrifices that we have made, most uses are not content with that.

Most array operations are commonly defined in terms of two fundamental actions: insertion and deletion. Let’s say we compare `[1, 2, 3]` and `[1, 3]`. A diff that describes it as “the 2 was incremented and the 3 was removed” is awkward compared to a simpler explanation, “we added a 2.” Occam’s razor strikes again.

Finding the minimal number of insert / delete operations is equivalent to a classical problem in computer science, the [Longest Common Subsequence](https://en.wikipedia.org/wiki/Longest_common_subsequence_problem) (hereafter LCS). Luckily, it is a perfect match for [dynamic programming](https://en.wikipedia.org/wiki/Dynamic_programming), and one of its redeeming examples! The algorithm that solves it merely scans every pair of elements, one from the “before” list, the other from the “after” list, starting from the left of the lists. It registers identical elements as part of a potential longest common subsequence, and tracks from which pair each subsequence was possible. When it is done, the last cell lets you backtrack to the first cell, feeding you the list of operations needed along the way.
![](https://78.media.tumblr.com/cbd9ac42a6e90ec3e8283e32cc8eb83c/tumblr_inline_ofloza53xh1qmhxug_540.png)

_LCS conversion from αβγ to αγ. The arrows are operations, the circles are pairs of elements and contain sub-sequences._

It is so wonderful that everybody uses it, from `diff` to `git` to numerous DNA comparison software products. It is also what most libraries I found use. [rfc6902-json-diff](https://github.com/cqql/rfc6902-json-diff-js) relies on a variant, the Levenshtein distance, which also detects substitutions (literally equivalent to an addition followed by a deletion). [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) tries to be smart by asking the user to feed it an object-identity algorithm, with which it can detect changes in position of list items. Finally, [hashdiff](https://github.com/liufengyun/hashdiff) includes a similarity algorithm which [tells LCS](https://github.com/liufengyun/hashdiff/blob/fff6fc28b51db16cdb6f005ef6aaea9a9a1f4d1e/lib/hashdiff/lcs.rb#L22) that two elements are identical if they are sufficiently similar, but it does not detect positional changes (and it is fairly slow).

Fundamentally, LCS only has fundamental operations: insertion and deletion. That is not enough to easily guess that an element has switched places! In fact, we would be better off if moving objects were a fundamental operation as well.

Furthermore, LCS is designed for lists where identity is unambiguous. Even [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) ends up performing a trivial [index-wise](https://github.com/benjamine/jsondiffpatch/blob/b7b7dfe52bbb4e88f3ecb87e2efbbb3af5f9c365/src/filters/arrays.js#L52) comparison when it has nothing else to work with! To be free from that flawed assumption, &nbsp;[hashdiff](https://github.com/liufengyun/hashdiff)’s idea is interesting: let’s compare the similarity of items!

## The Similarity

You can probably get eight definitions of what JSON similarity is by asking five passers-by. I don’t pretend to have a better definition, but I did try to have one that works well with move operations.

The goal is to compute an arbitrary notion of how probable it is that one object is the result of modifying the other.

*   For objects, take the average similarity between key values. We ignore key renames.
*   For arrays, the most likely match between an element in the old and the new list is presumably the right one, so we take the average of the maximum similarity between each pair of elements of each list.
*   For atoms, we are fine with value equality.![](https://78.media.tumblr.com/958a7d42ae1ab4b449314ee809b96249/tumblr_inline_oflp02uthm1qmhxug_540.png)

##  Array Pairing

Finding an ideal match between two lists sounds a lot like the [assignment problem for bipartite graphs](https://en.wikipedia.org/wiki/Assignment_problem). Imagine you own a fleet of available taxis. A set of passengers need picking up across town. The assignment problem wants to minimize the overall time that it takes for each taxi to arrive at a passenger’s location.
![](https://78.media.tumblr.com/f103c5883f404bce81dd17288b5252dd/tumblr_inline_oflp0zUOF41qmhxug_540.png)

_Above, minimizing the overall time. Below, minimizing the best time._

In our case, we want to minimize the best time, not the overall time. Among two array pairings of size 2, one with similarities 0.9 and 0.1, the other with similarities 0.8 and 0.4, one of the elements doesn’t seem to have been moved; it looks like an element was deleted and another was added. Given that, the pairing with 0.9 is most logical, and that is the one we want. Yet, maximizing the overall similarity would yield the inferior (0.8, 0.4) pairing.
![](https://78.media.tumblr.com/e0492d98e19d03338c93752272506116/tumblr_inline_oflp1kKJ3k1qmhxug_540.png)

The assignment problem has an O(n^3) polynomial solution, while the array pairing problem has an O(n^2) solution, which means it has the added bonus of being fast.

In fact, this problem is closer to the [weakly stable marriage problem](https://en.wikipedia.org/wiki/Stable_marriage_problem). However, it too can yield suboptimal results. Instead of optimizing for the highest similarity, it is content with any pairing for which no change could produce a pair with a higher similarity than each element of the pair had before. Depending on the ordering of elements in the lists, it can choose poorer pairings for our purposes.

Some diffs offer move operations (such as [rfc6902-json-diff](https://github.com/cqql/rfc6902-json-diff-js), [jsondiffpatch](https://github.com/benjamine/jsondiffpatch)). However, array pairing is not just about detecting moves; we want to detect the most logical moves. The root of the problem with LCS is that it needs to know about exact equality. Our fuzzy pairing can detect the most likely equality. LCS targets a response with the highest number of elements remaining in the same order; our pairing targets one with the most intuitive moves.

Its weakness is the quality of the similarity function, which empirically seems to give good answers, and can be improved by user-provided heuristics.

## Index Shifting

There is quite a bit of fun in turning the indices we got from pairing (which come directly from the positions of the source and target arrays) to ones that can be used for patching purposes. Indeed, when applying the diff, we take each operation and apply it sequentially. We expect indices to be offset by previous operations.

For instance, `[3, 2]` diffed with `[1, 2, 3]` will detect a pairing from index 0 of the source to index 2 of the target, but since an element is inserted at the beginning of the list prior to the move operation, that operation must be from index 1 to 2, instead of 0 to 2.

First, we need to perform all removals from the list, starting with the removal with the highest index (to avoid offsetting the subsequent removals). We compute from them a function that maps indices of elements of the list from where they were before the removals to where they are afterwards. We do the same, reversed, with the additions we plan to perform after the removals and the moves are done.

We now need two insights into the problem at hand.

1.  The pairs we have form a list of rings. Indeed, if whatever was at position i was sent to position j, whatever was at position j cannot have stayed at j. Therefore i goes to j, which goes to k, which goes to… well, at some point it has to come back to i, because the list is finite. Besides, we know that the source and target arrays have the same length.
2.  Each ring will rotate exactly once. When it does, no other element of the list will change position. As a result, a ring’s operations won’t offset the indices of the other rings.

As a result, the trickiest bit of the implementation is merely to detect offset changes in operations within a ring. Then we register the operations: first the removals, then the moves, then the additions. Done!

## Format Design

I will readily admit that producing a format that pleases all is impossible. That won’t stop me from judging them.

The [HashDiff](https://github.com/liufengyun/hashdiff) format for paths (eg. `foo[0].bar`) is awkward for machines and not that nice for humans to read.

[RFC 6902](http://tools.ietf.org/html/rfc6902) is the go-to standard. Unfortunately, it chose to use [RFC 6901](http://tools.ietf.org/html/rfc6901), aka. JSON pointer, for paths (eg. `/foo/0/bar`).

I have no idea why [RFC 6902](http://tools.ietf.org/html/rfc6902) did not simply use a list of strings and numbers. It is easy for humans to read, easy for machines to traverse (they have to convert the string to that list otherwise), and while it does save a few bytes when serialized, [RFC 6902](http://tools.ietf.org/html/rfc6902) is far from being a dense format to begin with. Finally, JSON pointer is forced to use a quirky escaping system: slashes are converted to `~1 `and tildes to `~0`.

But it is the standard… so I accepted its flaws and rolled with it.

## The road is long but fogless

As I wished that this had existed when I went fishing for an appropriate library, I published this new algorithm as a [gem](https://rubygems.org/gems/json-diff), whose open-source repository is [right here](https://github.com/espadrine/json-diff).

There are countless possible improvements we could make. Off the top of my head:

*   Optional LCS,
*   String diffing,
*   SVG output.

## Epilogue

This diffing algorithm allowed me to detect three problematic bugs which therefore never impacted anyone. When we switched to the new search engine, we gradually increased the proportion of users that it impacted. The higher it went, the more confident we were, until we reached 100%.

We changed the engine with the train at full throttle. Nobody noticed a thing!
