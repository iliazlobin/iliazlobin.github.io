---
layout: page
title: Blog
permalink: /blog/
description: "System design write-ups, platform & AI engineering notes, and deep dives by Ilia Zlobin — with architecture diagrams and code throughout."
---

<link rel="stylesheet" href="{{ '/assets/css/blog.css' | relative_url }}">

<p class="blog-intro">System design write-ups, platform &amp; AI engineering notes, and deep dives. Diagrams and code throughout.</p>

{%- if site.posts.size > 0 %}
{%- assign by_year = site.posts | group_by_exp: "p", "p.date | date: '%Y'" %}

<div class="blog-controls" data-blog-filter>
  <div class="filter-row" role="group" aria-label="Filter posts by topic">
    <button class="chip chip-filter is-active" data-filter="*" type="button">All <span class="count">{{ site.posts.size }}</span></button>
    {%- assign tags = site.tags | sort %}
    {%- for t in tags %}
    <button class="chip chip-filter" data-filter="{{ t[0] | escape }}" type="button">{{ t[0] }} <span class="count">{{ t[1].size }}</span></button>
    {%- endfor %}
  </div>
  {%- if by_year.size > 1 %}
  <div class="year-jump" aria-label="Jump to year">
    {%- for yg in by_year %}<a class="yr-chip" href="#y-{{ yg.name }}">{{ yg.name }}</a>{% endfor %}
  </div>
  {%- endif %}
</div>

<div class="post-feed" data-blog-feed>
  {%- for yg in by_year %}
  <div class="year-divider" id="y-{{ yg.name }}"><span>{{ yg.name }}</span></div>
  {%- for post in yg.items %}
  {%- assign words = post.content | number_of_words %}
  {%- assign minutes = words | divided_by: 200 | plus: 1 %}
  {%- assign seed = post.title | size | modulo: 6 %}
  {%- assign primary = post.tags | first | default: "Post" %}
  <article class="post-card" data-tags="{{ post.tags | join: '|' | escape }}">
    {%- if post.image %}
    <a class="pc-thumb" href="{{ post.url | relative_url }}" tabindex="-1" aria-hidden="true"><img src="{{ post.image | relative_url }}" alt="" loading="lazy"></a>
    {%- else %}
    <a class="pc-thumb placeholder g{{ seed }}" href="{{ post.url | relative_url }}" tabindex="-1" aria-hidden="true"><span>{{ primary }}</span></a>
    {%- endif %}
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
  </article>
  {%- endfor %}
  {%- endfor %}
</div>

<p class="no-results" hidden>No posts match that topic. <button class="link-btn" data-filter-clear type="button">Clear filter</button></p>
{%- else %}
<p>No posts yet — first write-ups landing soon.</p>
{%- endif %}
