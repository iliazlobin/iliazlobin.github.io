---
layout: page
title: Machine Learning
permalink: /machine-learning/
description: "Machine-learning system design write-ups by Ilia Zlobin — end-to-end ML architectures with data and feature pipelines, model and serving deep dives, evaluation, and trade-offs."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Reuses the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">Machine-learning system design write-ups — end-to-end ML architectures, section for section: problem &amp; ML framing, data and features, model, training and serving, evaluation, and the deep dives. Diagrams and code throughout.</p>

{% include design-list.html category="ml-system-design" prefix="ML System Design: " label="Machine Learning" %}
