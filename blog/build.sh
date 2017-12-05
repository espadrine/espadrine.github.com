#!/bin/bash

dir=$(dirname "$BASH_SOURCE")
template=$(cat "$dir"/template.html)
last_month=$(date -I -d 'last month')

post_links=
jsonfeed_items=
atomfeed_entries=
last_publication_date=

< "$dir"/publication tail -n +2 | {
  while read post; do
    name=$(echo "$post" | cut -d'	' -f1)
    isotime=$(echo "$post" | cut -d'	' -f2)
    last_publication_date="$isotime"
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
      jsonfeed_items=$(cat <<EOF
      {
        "id":  "https://espadrine.github.io/blog/posts/$name.html",
        "url": "https://espadrine.github.io/blog/posts/$name.html",
        "title": $(echo "$title" | jq . -R),
        "date_published": "$isotime"
        "content_html": $(echo "$content" | jq . -Rs),
      },
EOF
      )$'\n'"$jsonfeed_items"

      atomfeed_entries=$(cat <<EOF
      <entry>
        <id>https://espadrine.github.io/blog/posts/$name.html</id>
        <link rel="alternate" type="text/html" href="https://espadrine.github.io/blog/posts/$name.html"/>
        <title>$(echo "$title" | sed 's,<,&lt;,g'$'\n''s,>,&gt;,g')</title>
        <published>$isotime</published>
        <content type="html">
          <![CDATA[ $content ]]>
        </content>
      </entry>
EOF
      )$'\n'"$atomfeed_entries"
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
  < "$dir"/feed-template.xml sed '
    sLAST_PUBLICATION_DATE'"$last_publication_date"'
    /ENTRIES/ {
      r '<(echo -n "$atomfeed_entries")'
      d
    }' > "$dir"/feed.xml
}
