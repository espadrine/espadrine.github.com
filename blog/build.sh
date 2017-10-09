#!/bin/bash

dir=$(dirname "$BASH_SOURCE")
template=$(cat "$dir"/template.html)

post_links=

< "$dir"/publication tail -n +2 | {
  while read post; do
    name=$(echo "$post" | cut -d'	' -f1)
    isotime=$(echo "$post" | cut -d'	' -f2)
    time=$(date +'%-d %B %Y' -d "$isotime")
    markdown=$(cat "$dir"/src/"$name".md)
    title=$(echo "$markdown" | head -1 | sed 's/^# //')
    content=$(echo "$markdown" | commonmark)
    echo -n "$template" \
      | sed '
        sTITLE'"$title"'
        sISOTIME'"$isotime"'
        sTIME'"$time"'
        /POST/ {
          r '<(echo "$content")'
          d
        }' \
      > "$dir"/posts/"$name".html
    post_links='    <li><a href="posts/'"$name"'.html">'"$title"'</a></li>'$'\n'"$post_links"
  done

  < "$dir"/index-template.html sed '
    /POST_LINKS/ {
      r '<(echo -n "$post_links")'
      d
    }' > "$dir"/index.html
}
