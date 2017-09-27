# TheFileTree Design Log 1

I intend to rethink the ideas behind [TheFileTree](https://thefiletree.com).

# Files

Easy storage has a lot of competition, but the contenders often miss two important points.

1. Content needs to be edited, and since this is online, it needs seemless intent-preserving synchronization.
2. Data needs to be manipulated by programs, and since this is online, it needs to execute from within your tab.

Obviously, I need to have the basics working.

Each node of the tree is a file or a folder. They have metadata information detailing their type, time of last modification (and of last metadata update, to allow controlling changes), and various other fields to allow specifying which app to use to open a particular file. All that metadata is stored in a file called `metadata.json`, loaded in memory at start-up on the server. That way, metadata accesses are fast. In the future, we can offload parts to disk in a format that makes path accesses fast. *(In the past, each file had a separate json file holding its metadata, but the main page, for instance, lists files in order of modification (freshest first), which meant a lot of file reads.)*

![metadata.json](http://i.imgur.com/Bzfljmm.png)

When you fetch a node, it inspects its metadata, and shows you its content using its dedicated app. If there are none, or if you specify it, you can get it raw, with `?app=data`. You can also get its metadata with `?app=metadata`. For folders, the data is a list of the file names it contains. You can even submit a `Depth` header, inspired by WebDAV.

![Folder data sizes at various depth](http://i.imgur.com/SCUT5om.png)

Unsurprisingly, the download size scales exponentially with the requested depth.

I'll talk about other basics we must support in future logs.

# Collaboration

The simple fact that a file online can be opened in multiple tabs means that we need edition synchronization.

I have plans to make [jsonsync](https://github.com/espadrine/jsonsync) the first non-Operation Transformation, non-CRDT peer-to-peer synchronization system for JSON with index preservation. It has the benefits of both approaches: implementation simplicity, richness of operations and intention preservation of CRDT, and query speed and memory bounds of OT.

Any apps can probably maintain its content in a JSON structure, and update its UI according to changes in its data. Is that not reminiscent of the MVC pattern? I expect virtually any application to be built on top of those primitives.

I am unsure of whether I will rely on it to allow for offline edition. Whatever I do after an offline editing session, it will involve showing the user a diff of the content; as a user, I would not trust a blind merge for long, multiple-second simultaneous edition. But will I use jsonsync's algorithm, requiring it to hold on to its history for ever, or a cold three-way merge? Maybe something in-between?

# Extension

Shops are the economy's blood. Marketplaces are its heart.

I must ensure that anybody can create a new app. They can store it in a folder anywhere, and develop it from within TheFileTree. Anyone can open anything with any app. There is a tricky matter of trust there: we must warn users that they're about to use an app they hav never used before, to avoid information stealing from malicious app developers. It cannot happen from within the folder app, since they may land on a page from a crafted link sent to them. Still, it can be done; I am not too worried.

Something I am more worried about is whether I should allow apps to execute code on the server. I am leaning towards a "no", as I don't like taking that security risk. What if they find a way to gain shell access to the server?

Even without being allowed to execute code, apps can do anything, by making XHR requests to the server, using the API I will provide. Maybe HTTP2 Server Push will allow me to avoid waiting for the XHR call to send the data over, too, one day.

I'll talk about identity control in a future log. Obviously an important aspect.
