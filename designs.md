---
layout: page
title: Design
nav_title: Design
permalink: /designs/
description: "System, machine-learning, low-level and AI designs by Ilia Zlobin, with diagrams, code and trade-offs."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Designs reuse the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">System architecture, machine learning, low-level design and agentic AI. Explore the requirements, implementation choices and trade-offs, with diagrams and code.</p>

{% include design-list.html categories="system-design,system-design-ml,low-level-design,ai" label="Design" %}
