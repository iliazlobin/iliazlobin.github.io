---
layout: page
title: Research
permalink: /research/
description: "AI/ML research write-ups by Ilia Zlobin — rigorous paper surveys and hands-on empirical studies: literature taxonomies and lineage maps, method deep dives with intuition-first math, and reproducible experiments with results and analysis."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Reuses the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">Scientific AI/ML research — rigorous topic surveys (taxonomy, lineage, and method deep dives, intuition-first) alongside hands-on empirical studies that run the experiment and report the numbers. Papers, diagrams, and reproducible notebooks throughout.</p>

{% include design-list.html category="research" prefix="Research: " label="Research" %}
