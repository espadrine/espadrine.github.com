# CSS Variables vs. Multiple Background Images

I was working on [Tree](https://github.com/garden/tree) today. While in the process of adding file selection, I realized I was duplicating a lot of code for no good reason but the limitations of CSS3.

Tree is a collaborative file system. As such, it needs a file explorer. So far, that file explorer, dubbed Gateway, lacks the UI to delete files. Since there are many operations that work on one or more files, I needed to create a system to select multiple files. As it stands, files currently have a number of backgrounds: one image to indicate what type of file it is, and a background color to show which file is currently focused.

So far, that hasn't caused any issue, since for some reason, setting the background color and a background image isn't considered a multiple background. However, adding another background image to indicate that the file is selected, and another to hint, while hovering over a file, that you can click it to select it, forces it to go into multiple-background mode, and that distinction is no longer valid. As a result, I now have four backgrounds.

One part of the issue is that those backgrounds are either present or absent on any particular file. The other part is that when you change a multiple background, you have to include all the different backgrounds at the same time, so that the CSS engine can figure out the depth order between them from the order they have in the comma notation.

(For the sake of readability, I am only writing `bgfile` instead of a long background image declaration.)

    #filelist li.file {
      background: bgfile;
    }
    #filelist li.file.focus {
      background: bgfile, bgfocus;
    }
    #filelist li.file.selected.focus {
      background: bgfile, bgselected, bgfocus;
    }
    #filelist li.file.selected {
      background: bgfile, bgselected;
    }
    
    /* And all over again for folders… */
    #filelist li.folder {
      background: bgfolder;
    }
    /* etc. */

It should be clear by now that, given `n` different backgrounds, we have to write `2^n` different rules, and copy the very same background image `n`  times, causing a huge duplication of code! Not to mention related properties such as `background-position`, `background-size`, `background-repeat`, `background-origin` and `background-attachment`!

A (hopefully) upcoming CSS standard that would solve half of the problem is [CSS variables](http://dev.w3.org/csswg/css-variables/). Thanks to that, there would be no duplication of code, and we would only have to write the background rule once for every background, instead of `n`.

    #filelist {
      var-bgfile: bgfile;
      var-bgfolder: bgfolder;
      var-bgfocus: bgfocus;
      var-bgselected: bgselected;
    }
    
    #filelist li.file {
      background: var(bgfile);
    }
    #filelist li.file.focus {
      background: var(bgfile), var(bgfocus);
    }
    #filelist li.file.selected.focus {
      background: var(bgfile), var(bgselected), var(bgfocus);
    }
    #filelist li.file.selected {
      background: var(bgfile), var(bgselected);
    }
    /* etc. */

However, the example above has only `2^3 = 8` rules, but in order to add a visual hint upon hover that you can select a file, I should actually write `2^4 = 16` rules! And that exponentially increasing number of rules isn't solved by using CSS variables.

Fundamentally, the issue with it is that you cannot make partial background declarations. What would we need to make it happen? Introduce a z-index to backgrounds.

    partial-background: <bg-z-index> , <bg-image> || <position> [ / <bg-size> ]? || <repeat-style> || <attachment> || <box>{1,2}

And then I would have:

    #filelist li.file {
      partial-background: 3, bgfile;
    }
    #filelist li.folder {
      partial-background: 3, bgfolder;
    }
    #filelist li.selected {
      partial-background: 2, bgselected;
    }
    #filelist li.focus {
      partial-background: 1, bgfocus;
    }

Partial backgrounds only mix together: a normal background image declaration clears all partial backgrounds currently on, and plays by its own rules. However, partial backgrounds should work with `background-color`.

I don't have a strong opinion of what should happen when two z-index collide. One declaration could overwrite the other, or the behaviour could be undefined. In my case, we can't really have a file be a folder or vice-versa, and in general, having collisions should only happen by mistake. </box></attachment></repeat-style></bg-size></position></bg-image></bg-z-index>

<script type="application/ld+json">
{ "@context": "http://schema.org",
  "@type": "BlogPosting",
  "datePublished": "2013-11-25T20:33:00Z",
  "keywords": "css" }
</script>
