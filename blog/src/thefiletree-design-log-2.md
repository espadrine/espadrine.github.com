# TheFileTree Design Log 2: API

I have implemented the core API, which powers the folder app.

# API

I tried to stay close to WebDAV, even though I will differ from it in one significant fashion: no file locks.

- `GET /`: loads the file type's app (eg, a text editor, or a file browser).
- `GET /file?app=data`: downloads file content.
- `GET /?app=data`: gets a JSON list of the folder's contained file names. A `Depth: 0` HTTP header makes it get a map from file names to `{meta: …}`, which contains its metadata. Further depths also include a `{files: …}` key, which is yet again a map from file names to `{meta: …, [files: …]}`. I rely on the depth for fuzzy matching file names in the file browser.
- `GET /?app=metadata`: obtains the file's metadata as JSON.
- `PUT /?app=metadata Content-Type: application/json`: replace the file's metadata.
- `PUT /foo`: upload a file, creating it if necessary.
- `POST /?op=append&content=… Content-Type: multipart/form-data`: upload several files, creating them if needed.
- `MKCOL /`: create a folder.
- `DELETE /`: remove a file.

I will implement `COPY` and `MOVE` in the future; those operations were not supported in the past.

Metadata information is autosaved every 5 seconds when it changed.

I am afraid this whole reimplementation went faster than planned, leaving me in front of the difficult choice that I hoped to delay…

# Synchronized Editing

I wish to support synchronized editing for text and JSON, with index rebasing to preserve intentions. I see it as a WebSocket JSON stream over `/file?op=edit&app=text`. But what library should I use, and with which protocol? Canop is functional and efficient, although it requires centralization (which will remain unavoidable), but full-JSON is not implemented yet, nor are compound atomic transactions, only text. Meanwhile, jsonsync is functional and mostly relies on the JSON Patch standard (and also peer-to-peer, but this is useless in our case), but index rebasing is not implemented yet, and not as efficient as it is for Canop.

(Given proper index rebasing, there is no reason for which we could not support binary editing. However, if you are modifying a binary file, the synchronization cannot know whether the file gets corrupted, as it does not know its semantics, only its serialized form. For instance, a PNG file edited simultaneously may be synchronized to a state where the index rebasing results in an invalid file. To avoid file corruption, I won't provide binary synchronization.)

# Accounts

One of the large, long-term changes I wanted to include for a long time was **accounts**. In the former implementation of TheFileTree, everyone was anonymous, which both made it implausibly hard to scale (for instance, having private files necessitated passwords, one for each file, and giving access to a file meant sharing that password, which if the password is used on another file, means remembering a lot of passwords,etc…) and hard to sell (I wouldn't pay a subscription for a service that can't remember that I paid it).

However, I am unsure of the exact layout I want for the root folder. My initial thoughts:

- app (contains trusted apps, like "folder" for file exploration, "text" for editing, "markdown", "html", etc.),
- lib (shared libraries and assets used by app and the system, like a 404 page),
- api (fake inaccessible directory; used for actions like api/1/signup; I can probably make it hold manual pages upon GETting),
- demo (anonymous public access),
- about (help, manuals, owner information),
- One of the following:
  - Users are stored at the root (eg. thefiletree.com/espadrine), they cannot use the existing root file names as nick, and that potentially blocks me from creating new root files in the future (unless I reserve all 3-letter alphabetic words). There is no visual clutter though, as you only see folders you can enter.
  - @nick (Twitter syntax, slightly ugly but popular: thefiletree.com/@espadrine). Other options I considered are ~nick (as per httpd, but it just looks ugly, take a look: thefiletree.com/~espadrine), u (storing nicks, for instance thefiletree.com/u/espadrine, the Reddit way; but it encourages calling nicks /u/nick instead of @nick, and it doesn't make it feel like I am treated first-class as a user), usr (but it is 2 chars longer than u), and finally, the comfy unixy home (oh, thefiletree.com/home/espadrine), but it is even longer!.
- ~ (reserved to allow redirection to user directory, eg. thefiletree.com/~/my/content),
- favicon.ico,
- robots.txt,
- humans.txt.
