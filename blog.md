---
layout: page
title: Blog
permalink: /blog/
description: "System design write-ups, platform & AI engineering notes, and deep dives by Ilia Zlobin — with architecture diagrams and code throughout."
---

<link rel="stylesheet" href="{{ '/assets/css/blog.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<p class="blog-intro">System design write-ups, platform &amp; AI engineering notes, and deep dives. Diagrams and code throughout.</p>

{%- if site.posts.size > 0 %}
{%- assign by_year = site.posts | group_by_exp: "p", "p.date | date: '%Y'" %}

<div class="blog-controls" data-blog-filter>
  <div class="tag-input" data-tag-input>
    <svg class="ti-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
    <span class="ti-tokens"></span>
    <input type="text" class="ti-field" placeholder="Filter by topic…" aria-label="Filter posts by topic" autocomplete="off" spellcheck="false">
    <div class="ti-suggest" hidden role="listbox"></div>
  </div>
  <div class="bc-right">
    <span class="result-count" data-result-count></span>
    <button class="ti-clear" data-tag-clear type="button" hidden>Clear all</button>
  </div>
</div>
<script type="application/json" data-blog-tags>[{% for t in site.tags %}{"name": {{ t[0] | jsonify }}, "count": {{ t[1].size }}}{% unless forloop.last %},{% endunless %}{% endfor %}]</script>

<div class="post-feed" data-blog-feed>
  {%- for yg in by_year %}
  <div class="year-divider" id="y-{{ yg.name }}"><span>{{ yg.name }}</span></div>
  {%- for post in yg.items %}
  {%- assign words = post.content | number_of_words %}
  {%- assign minutes = words | divided_by: 200 | plus: 1 %}
  {%- assign seed = post.title | size | modulo: 6 %}
  {%- assign primary = post.tags | first | default: "Post" %}
  <article class="post-card" data-tags="{{ post.tags | join: '|' | escape }}">
    <div class="pc-body">
      <div class="meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d, %Y" }}</time>
        <span class="dot">·</span><span>{{ minutes }} min read</span>
      </div>
      <h3><a class="pc-title-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h3>
      <p>{{ post.excerpt | strip_html | truncatewords: 28 }}</p>
      {%- if post.tags.size > 0 %}
      <div class="pc-tags">
        {%- for tag in post.tags %}<a class="tag" href="{{ '/blog/' | relative_url }}?tag={{ tag | url_encode }}" data-tag="{{ tag | escape }}">{{ tag }}</a>{% endfor %}
      </div>
      {%- endif %}
    </div>
    {%- if post.thumbnail %}
    <a class="pc-thumb" href="{{ post.url | relative_url }}" tabindex="-1" aria-hidden="true"><img src="{{ post.thumbnail | relative_url }}" alt="" loading="lazy"></a>
    {%- else %}
    <a class="pc-thumb cover g{{ seed }}" href="{{ post.url | relative_url }}" tabindex="-1" aria-hidden="true">
      <span class="pc-cover-title">{{ post.title | escape }}</span>
      <span class="pc-cover-topic">{{ primary }}</span>
    </a>
    {%- endif %}
  </article>
  {%- endfor %}
  {%- endfor %}
</div>

<p class="no-results" hidden>No posts match that filter. <button class="link-btn" data-filter-clear type="button">Clear filter</button></p>
{%- else %}
<p>No posts yet — first write-ups landing soon.</p>
{%- endif %}
