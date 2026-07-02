---
layout: page
title: Designs
permalink: /designs/
description: "System design write-ups by Ilia Zlobin — production-grade architectures with diagrams, data models, deep dives, and trade-offs."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Designs reuse the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">System design write-ups — production-grade architectures, section for section: requirements, back-of-the-envelope estimates, data model, high-level design, and the deep dives. Diagrams and code throughout.</p>

{%- assign designs = site.designs | sort: "date" | reverse %}
{%- if designs.size > 0 %}
<div class="portfolio-layout">

<aside class="portfolio-rail">
  <div class="rail-title">Designs</div>
  <nav>
    {%- for d in designs %}
    {%- assign name = d.title | remove_first: "System Design: " %}
    <a href="#{{ d.title | slugify }}" data-spy><span class="nm">{{ name | escape }}</span></a>
    {%- endfor %}
  </nav>
</aside>

<div class="portfolio-feed">
  {%- for d in designs %}
  {%- assign name = d.title | remove_first: "System Design: " %}
  {%- assign seed = d.title | size | modulo: 6 %}
  <article id="{{ d.title | slugify }}" class="portfolio-item">
    {%- if d.thumbnail %}
    <a class="thumb" href="{{ d.url | relative_url }}" aria-label="{{ name | escape }} — read the design"><img src="{{ d.thumbnail | relative_url }}?v={{ site.time | date: '%s' }}" alt="{{ name | escape }} architecture diagram" loading="lazy"></a>
    {%- else %}
    <a class="thumb placeholder g{{ seed }}" href="{{ d.url | relative_url }}" aria-label="{{ name | escape }} — read the design"><span>{{ name | escape }}</span></a>
    {%- endif %}
    <div class="body">
      <h3><a href="{{ d.url | relative_url }}">{{ name | escape }}</a></h3>
      <p>{{ d.description | default: d.excerpt | strip_html | truncatewords: 46 }}</p>
      {%- if d.tags.size > 0 %}
      <ul class="tags">{% for tag in d.tags %}<li>{{ tag | escape }}</li>{% endfor %}</ul>
      {%- endif %}
      <div class="links"><a class="gh" href="{{ d.url | relative_url }}">Read the design →</a></div>
    </div>
  </article>
  {%- endfor %}
</div>
</div>
{%- else %}
<p>No designs yet — first write-ups landing soon.</p>
{%- endif %}
