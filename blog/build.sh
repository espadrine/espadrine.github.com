#!/bin/bash

dir=$(dirname "$BASH_SOURCE")
template=$(cat "$dir"/template.html)

< "$dir"/publication tail -n +2 | (while read post; do
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
done)
