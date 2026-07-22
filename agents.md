---
layout: page
title: Agents
permalink: /agents/
description: "AI agent write-ups by Ilia Zlobin — agentic system designs and deep dives: multi-agent orchestration, tool use, memory, evaluation, and the harnesses that turn LLMs into reliable autonomous workers."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">
<style>
  /* Reuses the Portfolio layout; the card title is a link to the write-up, so keep it
     reading as a heading (not default link-blue) and only tint on hover. */
  .portfolio-item h3 a { color: inherit; text-decoration: none; }
  .portfolio-item h3 a:hover { color: var(--accent); }
</style>

<p class="portfolio-intro">AI agents in practice — designs and deep dives on agentic systems: multi-agent orchestration, tool use, planning and memory, evaluation, and the harnesses that turn LLMs into reliable autonomous workers. Diagrams and code throughout.</p>

{% include design-list.html category="agents" prefix="Agents: " label="Agents" empty_text="No agent write-ups yet — first ones landing soon." %}
