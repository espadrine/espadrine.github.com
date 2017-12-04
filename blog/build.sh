#!/bin/bash

dir=$(dirname "$BASH_SOURCE")
template=$(cat "$dir"/template.html)
last_month=$(date -I -d 'last month')

post_links=
jsonfeed_items=

< "$dir"/publication tail -n +2 | {
  while read post; do
    name=$(echo "$post" | cut -d'	' -f1)
    isotime=$(echo "$post" | cut -d'	' -f2)
    time=$(date +'%-d %B %Y' -d "$isotime")
    markdown=$(cat "$dir"/src/"$name".md)
    title=$(echo "$markdown" | head -1 | sed 's/^# //')
    content=$(echo "$markdown" | commonmark --smart)
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

    # We expect RSS feed clients to poll at least once a month.
    if [[ "$isotime" > "$last_month" ]]; then
      jsonfeed_items=$(
      cat <<-EOF
      {
        "id":  "https://espadrine.github.io/blog/posts/$name.html",
        "url": "https://espadrine.github.io/blog/posts/$name.html",
        "title": $(echo "$title" | jq . -R),
        "date_published": "$isotime"
        "content_html": $(echo "$content" | jq . -Rs),
      },
EOF
      )$'\n'"$jsonfeed_items"
    fi
  done

  < "$dir"/index-template.html sed '
    /POST_LINKS/ {
      r '<(echo -n "$post_links")'
      d
    }' > "$dir"/index.html
  jsonfeed_items="${jsonfeed_items%??}"$'\n'
  < "$dir"/feed-template.json sed '
    /ITEMS/ {
      r '<(echo -n "$jsonfeed_items")'
      d
    }' > "$dir"/feed.json
}
