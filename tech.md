---
layout: page
title: Tech
permalink: /tech/
description: "Tech deep-dive write-ups by Ilia Zlobin — single-technology deep dives into databases, message queues, orchestration, and the systems that power modern applications."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Reuses the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">Tech deep-dive write-ups — single-technology deep dives into databases, message queues, orchestration, and the systems that power modern applications. Diagrams and code throughout.</p>

{% include design-list.html category="tech" prefix="Tech: " label="Tech" empty_text="No tech deep-dive write-ups yet — first ones landing soon." %}
