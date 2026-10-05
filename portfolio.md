---
layout: page
title: Portfolio
permalink: /portfolio/
description: "Selected work by Ilia Zlobin across AI/agentic systems, cloud platform engineering, and applied ML — with source code, architecture diagrams, and walkthrough videos."
projects:
  hermes:
    type: ai-ml
    tags: [AI Agents, Multi-Agent, Orchestration, Hermes Agent, Docker, SQLite, Slack, Notion]
  agentic-enterprise:
    type: infra
    tags: [IaC, Multi-Account, Multi-Agent, Pulumi, AWS, LangGraph, TypeScript, EKS]
  events-concierge:
    type: full-stack
    tags: [AI Agents, Browser Automation, Python, LangGraph, AutoGen, Playwright, Google Calendar]
  ingestion-pipeline:
    type: infra
    tags: [Data Pipelines, Hybrid Search, Serverless, TypeScript, SST, Lambda, DynamoDB, OpenSearch, Step Functions]
  swe-agent:
    type: ai-ml
    tags: [AI Agents, Multi-Agent, Developer Tools, TypeScript, LangGraph, Next.js, GitHub App, Playwright, Docker]
  transformers:
    type: research
    tags: [Fine-Tuning, NLP, LLM Evaluation, PyTorch, Hugging Face, LoRA, BitsAndBytes, PEFT, Quantization]
  dspy:
    type: research
    tags: [LLM Pipelines, Python, DSPy, RAG, LLM Evaluation, Jupyter]
  blog-summarizer:
    type: full-stack
    tags: [Data Pipelines, Summarization, Full-Stack, Next.js, Lambda, Step Functions, OpenAI, LangChain, Notion API, SST]
  personal-website:
    type: full-stack
    tags: [Full-Stack, Next.js, React, TypeScript, Tailwind CSS, Vercel]
  atmos:
    type: infra
    tags: [IaC, Multi-Account, Networking, Terraform, Atmos, AWS, Cloud WAN, Helmfile, EKS]
  twitter-recsys:
    type: research
    tags: [Recommendation Systems, Ranking, Graph ML, Python, Scala]
  voicematch-models:
    type: ai-ml
    tags: [Speech, Model Serving, Python, PyTorch, Hugging Face, TensorFlow, Docker, SageMaker]
  voicematch-app:
    type: full-stack
    tags: [Speech, Full-Stack, Vue.js, TypeScript, Python, PyTorch, TensorFlow, AWS, Serverless]
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<p class="portfolio-intro">Selected work across AI/agentic systems, cloud platform engineering, and applied ML — with source code, architecture diagrams, and walkthrough videos.</p>

<section class="design-browser portfolio-browser" data-content-browser aria-label="Portfolio browser">
<div class="blog-controls design-controls" data-blog-filter data-unified-search data-count-noun="project" data-item-label="Project">
  <div class="type-filters" role="group" aria-label="Filter Portfolio by category">
    <button class="type-filter" type="button" data-type-filter="" aria-pressed="true">All</button>
    {%- for type in site.data.project_types %}
    <button class="type-filter" type="button" data-type-filter="{{ type[0] }}" aria-pressed="false">{{ type[1] }}</button>
    {%- endfor %}
  </div>
  <div class="tag-input unified-search" data-tag-input>
    <svg class="ti-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
    <span class="ti-tokens"></span>
    <input type="search" class="ti-field" data-content-search placeholder="Search titles, descriptions or tags…" aria-label="Search Portfolio" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="portfolio-search-suggestions" autocomplete="off" spellcheck="false">
    <button class="ti-clear" data-tag-clear type="button" hidden>Clear all</button>
    <div id="portfolio-search-suggestions" class="ti-suggest" hidden role="listbox" aria-label="Search suggestions"></div>
  </div>
  <span class="result-count" data-result-count role="status" aria-live="polite"></span>
</div>

<div class="portfolio-layout design-layout">

<aside class="portfolio-rail">
  <div class="rail-group">
  <div class="rail-title">Projects</div>
  <nav aria-label="Project navigation">
    <a href="#hermes" data-spy><span class="yr">2026</span><span class="nm">Hermes Agent Fleet</span><span class="star">★</span></a>
    <a href="#agentic-enterprise" data-spy><span class="yr">2025</span><span class="nm">Agentic Enterprise</span><span class="star">★</span></a>
    <a href="#events-concierge" data-spy><span class="yr">2025</span><span class="nm">Events Concierge</span><span class="star">★</span></a>
    <a href="#ingestion-pipeline" data-spy><span class="yr">2025</span><span class="nm">Ingestion Pipeline</span><span class="star">★</span></a>
    <a href="#swe-agent" data-spy><span class="yr">2025</span><span class="nm">SWE Agent</span></a>
    <a href="#transformers" data-spy><span class="yr">2024</span><span class="nm">Transformers FT</span><span class="star">★</span></a>
    <a href="#dspy" data-spy><span class="yr">2024</span><span class="nm">DSPy Research</span></a>
    <a href="#blog-summarizer" data-spy><span class="yr">2024</span><span class="nm">Blog Summarizer</span></a>
    <a href="#personal-website" data-spy><span class="yr">2024</span><span class="nm">Personal Website</span></a>
    <a href="#atmos" data-spy><span class="yr">2023</span><span class="nm">Atmos Landing Zones</span><span class="star">★</span></a>
    <a href="#twitter-recsys" data-spy><span class="yr">2023</span><span class="nm">Twitter Recsys</span></a>
    <a href="#voicematch-models" data-spy><span class="yr">2022</span><span class="nm">Voicematch Models</span></a>
    <a href="#voicematch-app" data-spy><span class="yr">2022</span><span class="nm">VoiceMatch App</span></a>
  </nav>
  </div>
</aside>

<div class="portfolio-feed" data-blog-feed tabindex="0" role="region" aria-label="Portfolio projects">

<article id="hermes" class="portfolio-item is-featured reveal" data-type="{{ page.projects.hermes.type | escape }}" data-tags="{{ page.projects.hermes.tags | join: '|' | escape }}">
  <a class="thumb" href="/designs/agents-hermes-a-high-level-overview/"><img src="/images/posts/agents-hermes-a-high-level-overview.svg" alt="Hermes agent fleet architecture diagram" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2026" type=page.projects.hermes.type %}
    <h3>Hermes - Autonomous AI Agent Fleet</h3>
    <p>A one-operator autonomous agent fleet built on the open-source Hermes Agent framework (Nous Research), run at production scale: 21 kanban boards, 98 specialized worker profiles, and 2,100+ completed tasks at a 93% completion rate. Slack channels route each vertical - research, system design, infrastructure, builds, content - onto durable dependency-gated boards worked by disposable Docker sandboxes. Deterministic gate scripts and cross-model rubric verifiers decide what ships; the system-design, infra, and tech write-ups on this site are its output.</p>
    {% include project-labels.html tags=page.projects.hermes.tags %}
    <div class="links"><a href="/designs/agents-hermes-a-high-level-overview/">Case Study ↗</a></div>
  </div>
</article>

<article id="agentic-enterprise" class="portfolio-item is-featured reveal" data-type="{{ page.projects.agentic-enterprise.type | escape }}" data-tags="{{ page.projects.agentic-enterprise.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/agentic-enterprise-design.png" target="_blank" rel="noopener"><img src="/images/agentic-enterprise-design.png" alt="Agentic Enterprise system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2025" type=page.projects.agentic-enterprise.type %}
    <h3>Agentic Enterprise — AWS + Pulumi + LangGraph</h3>
    <p>A code-first, multi-account AWS landing zone built entirely in Pulumi/TypeScript — Organizations, SCPs, SSO, a networking hub, EKS and serverless platforms, wired with typed cross-stack references. LangGraph domain assistants collaborate by proposing deterministic infrastructure changes as pull requests, under the same IaC, IAM, and CI/CD guardrails as humans.</p>
    {% include project-labels.html tags=page.projects.agentic-enterprise.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/agentic-enterprise" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="events-concierge" class="portfolio-item is-featured reveal" data-type="{{ page.projects.events-concierge.type | escape }}" data-tags="{{ page.projects.events-concierge.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/events-planner-agent-system-design.png" target="_blank" rel="noopener"><img src="/images/events-planner-agent-system-design.png" alt="AI Events Concierge system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2025" type=page.projects.events-concierge.type %}
    <h3>AI Events Concierge — Full-Stack Agentic System</h3>
    <p>An AI concierge that turns a plain-English request into confirmed sign-ups on your calendar. A LangGraph supervisor searches and ranks events from OpenSearch, then a customized AutoGen web-surfer drives a real Chrome session over Playwright to register on Meetup/Luma — handling forms and checkboxes — and writes de-duplicated events to Google Calendar.</p>
    {% include project-labels.html tags=page.projects.events-concierge.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/events-planner-agents" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.youtube.com/watch?v=ORLfWH-2Zfc&t=714s" target="_blank" rel="noopener">▶ Video</a></div>
  </div>
</article>

<article id="ingestion-pipeline" class="portfolio-item is-featured reveal" data-type="{{ page.projects.ingestion-pipeline.type | escape }}" data-tags="{{ page.projects.ingestion-pipeline.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/events-planner-ingest-system-design.png" target="_blank" rel="noopener"><img src="/images/events-planner-ingest-system-design.png" alt="Event ingestion and ranking pipeline system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2025" type=page.projects.ingestion-pipeline.type %}
    <h3>Event Ingestion &amp; Ranking Pipeline</h3>
    <p>A fully serverless, event-driven AWS platform (SST infrastructure-as-code) that ingests events from crawlers, enriches and ranks them with LLM feature scoring (OpenAI + LangChain), and indexes them in OpenSearch for hybrid search. Step Functions orchestrate ingest, enrichment, and scheduled social publishing end to end with retries and idempotency.</p>
    {% include project-labels.html tags=page.projects.ingestion-pipeline.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/events-planner-sst" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="swe-agent" class="portfolio-item reveal" data-type="{{ page.projects.swe-agent.type | escape }}" data-tags="{{ page.projects.swe-agent.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/open-swe-agent-ext-langgraph.png" target="_blank" rel="noopener"><img src="/images/open-swe-agent-ext-langgraph.png" alt="Software Engineer Agent system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2025" type=page.projects.swe-agent.type %}
    <h3>Software Engineer Agent</h3>
    <p>An autonomous AI software engineer that takes a GitHub issue and ships a reviewed, tested pull request — a hierarchy of LangGraph agents for planning, programming, review, and E2E testing, built on LangChain's Open SWE. Executes code in isolated Daytona sandboxes and drives Playwright behind a human-in-the-loop gate.</p>
    {% include project-labels.html tags=page.projects.swe-agent.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/software-developer-agent" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="transformers" class="portfolio-item is-featured reveal" data-type="{{ page.projects.transformers.type | escape }}" data-tags="{{ page.projects.transformers.tags | join: '|' | escape }}">
  <a class="thumb placeholder" href="https://github.com/iliazlobin/transformers-labs" target="_blank" rel="noopener"><span>Transformer Fine-Tuning<br>LoRA · Quantization · GEC</span></a>
  <div class="body">
    {% include project-labels.html year="2024" type=page.projects.transformers.type %}
    <h3>Transformers Fine-Tuning — LLM Research</h3>
    <p>A hands-on lab-book adapting transformer LLMs to grammatical error correction. ~35 notebooks fine-tune T5, BART, GPT-2, Phi-2, Gemma, and Llama-2 with LoRA and 4/8-bit quantization, scored through a reproducible ROUGE/SARI/SacreBLEU harness — LoRA lifts base T5-large from 0.36 to 0.89 ROUGE-1, all runnable on a single consumer GPU.</p>
    {% include project-labels.html tags=page.projects.transformers.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/transformers-labs" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.youtube.com/watch?v=rY0f1GRK0h8" target="_blank" rel="noopener">▶ Research</a><a href="https://www.youtube.com/watch?v=k8XlLoGFIh0" target="_blank" rel="noopener">▶ Fine-Tuning</a></div>
  </div>
</article>

<article id="dspy" class="portfolio-item reveal" data-type="{{ page.projects.dspy.type | escape }}" data-tags="{{ page.projects.dspy.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/dspy-demo-system-design.png" target="_blank" rel="noopener"><img src="/images/dspy-demo-system-design.png" alt="DSPy system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2024" type=page.projects.dspy.type %}
    <h3>DSPy — Declarative Language Programs</h3>
    <p>A research repo exploring DSPy, the framework that reframes prompt engineering as machine learning — declaring LLM pipelines as composable, trainable programs. Notebooks build, evaluate, and compile real pipelines for HumanEval code-gen, company valuation (RAG + LLM-as-judge), and multi-stage market analysis.</p>
    {% include project-labels.html tags=page.projects.dspy.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/dspy-research" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.youtube.com/watch?v=NXI2l0wJNBY" target="_blank" rel="noopener">▶ Video</a></div>
  </div>
</article>

<article id="blog-summarizer" class="portfolio-item reveal" data-type="{{ page.projects.blog-summarizer.type | escape }}" data-tags="{{ page.projects.blog-summarizer.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/blog-summarizer-system-design.png" target="_blank" rel="noopener"><img src="/images/blog-summarizer-system-design.png" alt="Cloud blog summarizer system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2024" type=page.projects.blog-summarizer.type %}
    <h3>Cloud Blog Summarizer — Full-Stack</h3>
    <p>A cloud-native SST monorepo that turns the firehose of AWS/Azure/GCP engineering blogs into a curated knowledge base. Apify crawls posts; an AWS Step Functions workflow dedupes, extracts, and summarizes each through a LangChain + OpenAI chain with typed structured output, publishing to Notion and a Next.js site.</p>
    {% include project-labels.html tags=page.projects.blog-summarizer.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/iliazlobin-sst" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="personal-website" class="portfolio-item reveal" data-type="{{ page.projects.personal-website.type | escape }}" data-tags="{{ page.projects.personal-website.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/personal-website-system-design.png" target="_blank" rel="noopener"><img src="/images/personal-website-system-design.png" alt="Personal website system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2024" type=page.projects.personal-website.type %}
    <h3>Personal Website — Full-Stack</h3>
    <p>A modern Next.js frontend for the iliazlobin-sst cloud-automation platform — a fast, scalable interface for browsing summarized blog content and automation workflows, deployed on Vercel with Tailwind CSS.</p>
    {% include project-labels.html tags=page.projects.personal-website.tags %}
    <div class="links"><a href="https://www.youtube.com/watch?v=171fy2U77iU&t=886s" target="_blank" rel="noopener">▶ Demo Video</a></div>
  </div>
</article>

<article id="atmos" class="portfolio-item is-featured reveal" data-type="{{ page.projects.atmos.type | escape }}" data-tags="{{ page.projects.atmos.tags | join: '|' | escape }}">
  <a class="thumb placeholder" href="https://github.com/iliazlobin/atmos-landing-zones" target="_blank" rel="noopener"><span>Atmos Landing Zones<br>AWS Multi-Account IaC</span></a>
  <div class="body">
    {% include project-labels.html year="2023" type=page.projects.atmos.type %}
    <h3>Atmos Landing Zones — IaC</h3>
    <p>A production-style AWS Landing Zone as modular IaC with Cloud Posse Atmos, Terraform, and Helmfile. Vends a multi-account AWS Organization with SSO/SAML role delegation, segmented VPCs on a global Cloud WAN core, SCP-based guardrails, and centralized audit logging — all from a single stack tree inside a reproducible Geodesic shell.</p>
    {% include project-labels.html tags=page.projects.atmos.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/atmos-landing-zones" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="twitter-recsys" class="portfolio-item reveal" data-type="{{ page.projects.twitter-recsys.type | escape }}" data-tags="{{ page.projects.twitter-recsys.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/twitter-recommendation-system-system-design.png" target="_blank" rel="noopener"><img src="/images/twitter-recommendation-system-system-design.png" alt="Twitter recommendation system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2023" type=page.projects.twitter-recsys.type %}
    <h3>Twitter Recommendation System — ML Research</h3>
    <p>An in-depth analysis of Twitter's open-sourced recommendation algorithm — RealGraph engagement prediction, MaskNet ranking, SimClusters community embeddings, and the TwHIN interaction graph — with walkthroughs of the official source code and the key papers.</p>
    {% include project-labels.html tags=page.projects.twitter-recsys.tags %}
    <div class="links"><a href="https://www.youtube.com/watch?v=F-bvRXIQemg&t=418s" target="_blank" rel="noopener">▶ Video</a></div>
  </div>
</article>

<article id="voicematch-models" class="portfolio-item reveal" data-type="{{ page.projects.voicematch-models.type | escape }}" data-tags="{{ page.projects.voicematch-models.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/voicematch-labs-system-design.png" target="_blank" rel="noopener"><img src="/images/voicematch-labs-system-design.png" alt="Voicematch Models system design" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2022" type=page.projects.voicematch-models.type %}
    <h3>Voicematch Models — Speech/Audio ML</h3>
    <p>A speech/audio analysis toolkit and container suite for word, phoneme, and pitch evaluation. Ready-to-deploy Docker images and serving scripts with custom inference handlers for Wav2Vec2 (Hugging Face) and TensorFlow SPICE, targeting AWS SageMaker / TorchServe.</p>
    {% include project-labels.html tags=page.projects.voicematch-models.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/voicematch-labs/tree/master/voicematch-models" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="voicematch-app" class="portfolio-item reveal" data-type="{{ page.projects.voicematch-app.type | escape }}" data-tags="{{ page.projects.voicematch-app.tags | join: '|' | escape }}">
  <a class="thumb" href="/images/voicematch-labs-demo.png" target="_blank" rel="noopener"><img src="/images/voicematch-labs-demo.png" alt="VoiceMatch demo" loading="lazy"></a>
  <div class="body">
    {% include project-labels.html year="2022" type=page.projects.voicematch-app.type %}
    <h3>VoiceMatch — AI Pronunciation Platform</h3>
    <p>A full-stack, cloud-native English pronunciation coach that analyzes speech down to individual phonemes and its pitch contour, then visualizes it against a native-speaker reference. A Vue 3 frontend captures audio in-browser; a serverless AWS backend fans requests out to three ML inference services (Wav2Vec2, SPICE).</p>
    {% include project-labels.html tags=page.projects.voicematch-app.tags %}
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/voicematch-labs" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<p class="no-results" hidden>No projects match those filters. <button class="link-btn" data-filter-clear type="button">Clear filters</button></p>
</div>
</div>
</section>
