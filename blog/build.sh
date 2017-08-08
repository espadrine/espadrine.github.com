#!/bin/bash

dir=$(dirname "$BASH_SOURCE")
template=$(cat "$dir"/template.html)

< "$dir"/publication tail -n +2 | (while read post; do
  name=$(echo "$post" | cut -d'	' -f1)
  date=$(echo "$post" | cut -d'	' -f2)
  markdown=$(cat "$dir"/src/"$name".md)
  title=$(echo "$markdown" | head -1 | sed 's/^# //')
  content=$(echo "$markdown" | commonmark)
  echo -n "$template" \
    | sed '
      sTITLE'"$title"'
      /POST/ {
        r '<(echo "$content")'
        d
      }' \
    > "$dir"/posts/"$name".html
done)
