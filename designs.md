---
layout: page
title: System Design
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

{% include design-list.html category="system-design" prefix="System Design: " label="System Design" %}
