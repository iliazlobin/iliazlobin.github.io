---
layout: page
title: Infra
permalink: /infrastructure/
description: "Infrastructure & platform write-ups by Ilia Zlobin — the last mile to get projects and experiments running: on-prem and AWS/GCP/Azure, DevOps/MLOps, CI/CD, deployment, SRE, and observability."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Reuses the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">Infrastructure &amp; platform write-ups — the last mile to get projects and experiments actually running: on-prem and AWS/GCP/Azure, DevOps and MLOps, CI/CD, deployment, SRE, and observability. Diagrams and code throughout.</p>

{% include design-list.html category="infra" prefix="Infra: " label="Infra" %}
