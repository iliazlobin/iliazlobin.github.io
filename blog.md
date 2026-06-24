---
layout: page
title: Blog
permalink: /blog/
---

<link rel="stylesheet" href="{{ '/assets/css/blog.css' | relative_url }}">

<p class="blog-intro">System design write-ups, platform &amp; AI engineering notes, and deep dives. Diagrams and code throughout.</p>

{%- if site.posts.size > 0 %}
<div class="post-feed" data-infinite data-initial="8" data-batch="6">
  {%- for post in site.posts %}
  {%- assign words = post.content | number_of_words -%}
  {%- assign minutes = words | divided_by: 200 | plus: 1 -%}
  <a class="post-card" href="{{ post.url | relative_url }}">
    <div class="meta">
      <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%B %-d, %Y" }}</time>
      <span>· {{ minutes }} min read</span>
      {%- if post.tags and post.tags.size > 0 %}
      <span class="post-tags">{% for tag in post.tags %}<span class="tag">{{ tag }}</span>{% endfor %}</span>
      {%- endif %}
    </div>
    <h3>{{ post.title | escape }}</h3>
    <p>{{ post.excerpt | strip_html | truncatewords: 32 }}</p>
    <span class="read">Read more →</span>
  </a>
  {%- endfor %}
</div>
{%- else %}
<p>No posts yet — first write-ups landing soon.</p>
{%- endif %}
