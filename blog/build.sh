#!/bin/bash

dir=$(dirname "$BASH_SOURCE")
template=$(cat "$dir"/template.html)
last_year=$(date -I -d 'last year')
mkdir -p .cache/html

post_links=
jsonfeed_items=
atomfeed_entries=
last_publication_date=

publications=$(ls "$dir"/src/*.md | sed 's,^.*/,,; s,\.md$,,' | \
  { while read src; do
    echo $(<"$dir/src/$src.md" grep '^  "datePublished"' | \
      cut -d'"' -f4 | cut -d' ' -f2)$'\t'"$src";
  done } | sort)
pubcount=$(echo "$publications" | wc -l)

echo "$publications" | {
  while read post; do
    name=$(echo "$post" | cut -d$'\t' -f2)
    mdfile="$dir/src/$name".md
    htmlfile="$dir/posts/$name".html
    htmlcachefile="$dir/.cache/html/$name".html
    titlecachefile="$dir/.cache/title/$name".title
    metacachefile="$dir/.cache/meta/$name".meta
    isotime=$(echo "$post" | cut -d$'\t' -f1)
    last_publication_date="$isotime"
    time=$(date +'%-d %B %Y' -d "$isotime")

    # Metadata update.
    markdown=$(cat "$mdfile")
    title=$(echo "$markdown" | head -1 | sed 's/^# //')
    meta=$(echo "$markdown" |
      awk '/^<script type="application\/ld/ {keep=1;next} /^<\/script>/ {keep=0} keep')
    keywords=$(echo "$meta" | jq -r .keywords)
    tags=$(echo "$keywords" | sed 's/, */ /g')

    # Article page generation.
    if [[ ! -a "$htmlcachefile" || "$mdfile" -nt "$htmlcachefile" ]]; then
      echo -n "Generating $name: "; date -Ins
      # The file has an update; otherwise skip its generation.
      markdown=${markdown:-$(cat "$mdfile")}
      content=$(echo "$markdown" | latexmarkdown --body)
      echo "$content" >"$htmlcachefile"
      html_tags=$(for k in $tags; do
        echo " <a class=tag href=\"../index.html?tags=$k\">$k</a>";
      done | sed '$!s/$/,/')
      echo -n "$template" \
        | sed '
          /TAGS/ {
            r '<(if [[ "$html_tags" ]]; then
                echo '      Tags:'"$html_tags".;
              fi)'
            d
          }
          sTITLE'"$title"'
          sPUBCOUNT'"$pubcount"'
          sISOTIME'"$isotime"'
          sTIME'"$time"'
          /POST/ {
            r '<(echo "$content")'
            d
          }' \
        > "$htmlfile"
    fi

    # Index page generation.
    index_html_tags=$(for k in $tags; do
      echo " <a class=tag href=\"?tags=$k\">$k</a>";
    done | sed '$!s/$/,/')
    post_links=$(cat <<EOF
      <li data-tags="$keywords">
        <a href="posts/$name.html">$title</a>
        $(if [[ "$index_html_tags" ]]; then
          echo "<span class=post-tags>Tags:$index_html_tags</span>";
        fi)
      </li>
$post_links
EOF
      )

    # RSS feeds generation.
    # We expect RSS feed clients to poll at least once a year.
    if [[ "$isotime" > "$last_year" ]]; then
      content=$(cat "$htmlcachefile")
      jsonfeed_items=$(cat <<EOF
      {
        "id":  "https://espadrine.github.io/blog/posts/$name.html",
        "url": "https://espadrine.github.io/blog/posts/$name.html",
        "title": $(echo "$title" | jq . -R),
        "tags": "$tags",
        "date_published": "$isotime"
        "content_html": $(echo "$content" | jq . -Rs),
      },
EOF
      )$'\n'"$jsonfeed_items"

      atom_categories=$(for k in $tags; do
        echo "<category term=\"$k\"/>";
      done)
      atomfeed_entries=$(cat <<EOF
      <entry>
        <id>https://espadrine.github.io/blog/posts/$name.html</id>
        <link rel="alternate" type="text/html" href="https://espadrine.github.io/blog/posts/$name.html"/>
        <title>$(echo "$title" | sed 's,<,&lt;,g'$'\n''s,>,&gt;,g')</title>
        <published>$isotime</published>
        $atom_categories
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
