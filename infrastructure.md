---
layout: page
title: Infrastructure
nav_title: Infra
permalink: /infrastructure/
description: "Infrastructure and technology deep dives by Ilia Zlobin: cloud platforms, databases, messaging, deployment and observability."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Reuses the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">Cloud platforms and the technologies behind them: databases, messaging, orchestration, deployment and observability. Diagrams and code throughout.</p>

{% include design-list.html categories="infra,tech" label="Infrastructure" %}
