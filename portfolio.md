---
layout: page
title: Portfolio
nav_title: Work
permalink: /portfolio/
description: "Selected work by Ilia Zlobin across AI/agentic systems, cloud platform engineering, and applied ML — each with source code, architecture diagrams, and walkthrough videos."
---

<link rel="stylesheet" href="{{ '/assets/css/portfolio.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<p class="portfolio-intro">Selected work across AI/agentic systems, cloud platform engineering, and applied ML — each with source code, architecture diagrams, and walkthrough videos.</p>

<div class="portfolio-layout">

<aside class="portfolio-rail">
  <div class="rail-title">Projects</div>
  <nav>
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
</aside>

<div class="portfolio-feed">

<article id="agentic-enterprise" class="portfolio-item is-featured reveal">
  <a class="thumb" href="/images/agentic-enterprise-design.png" target="_blank" rel="noopener"><img src="/images/agentic-enterprise-design.png" alt="Agentic Enterprise system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2025</div>
    <h3>Agentic Enterprise — AWS + Pulumi + LangGraph</h3>
    <p>A code-first, multi-account AWS landing zone built entirely in Pulumi/TypeScript — Organizations, SCPs, SSO, a networking hub, EKS and serverless platforms, wired with typed cross-stack references. LangGraph domain assistants collaborate by proposing deterministic infrastructure changes as pull requests, under the same IaC, IAM, and CI/CD guardrails as humans.</p>
    <ul class="tags"><li>Pulumi</li><li>AWS</li><li>LangGraph</li><li>TypeScript</li><li>EKS</li><li>Multi-Account</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/agentic-enterprise" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="events-concierge" class="portfolio-item is-featured reveal">
  <a class="thumb" href="/images/events-planner-agent-system-design.png" target="_blank" rel="noopener"><img src="/images/events-planner-agent-system-design.png" alt="AI Events Concierge system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2025</div>
    <h3>AI Events Concierge — Full-Stack Agentic System</h3>
    <p>An AI concierge that turns a plain-English request into confirmed sign-ups on your calendar. A LangGraph supervisor searches and ranks events from OpenSearch, then a customized AutoGen web-surfer drives a real Chrome session over Playwright to register on Meetup/Luma — handling forms and checkboxes — and writes de-duplicated events to Google Calendar.</p>
    <ul class="tags"><li>Python</li><li>LangGraph</li><li>AutoGen</li><li>Playwright</li><li>Google Calendar</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/events-planner-agents" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.youtube.com/watch?v=ORLfWH-2Zfc&t=714s" target="_blank" rel="noopener">▶ Video</a></div>
  </div>
</article>

<article id="ingestion-pipeline" class="portfolio-item is-featured reveal">
  <a class="thumb" href="/images/events-planner-ingest-system-design.png" target="_blank" rel="noopener"><img src="/images/events-planner-ingest-system-design.png" alt="Event ingestion and ranking pipeline system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2025</div>
    <h3>Event Ingestion &amp; Ranking Pipeline</h3>
    <p>A fully serverless, event-driven AWS platform (SST infrastructure-as-code) that ingests events from crawlers, enriches and ranks them with LLM feature scoring (OpenAI + LangChain), and indexes them in OpenSearch for hybrid search. Step Functions orchestrate ingest, enrichment, and scheduled social publishing end to end with retries and idempotency.</p>
    <ul class="tags"><li>TypeScript</li><li>SST</li><li>Lambda</li><li>DynamoDB</li><li>OpenSearch</li><li>Step Functions</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/events-planner-sst" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="swe-agent" class="portfolio-item reveal">
  <a class="thumb" href="/images/open-swe-agent-ext-langgraph.png" target="_blank" rel="noopener"><img src="/images/open-swe-agent-ext-langgraph.png" alt="Software Engineer Agent system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2025</div>
    <h3>Software Engineer Agent</h3>
    <p>An autonomous AI software engineer that takes a GitHub issue and ships a reviewed, tested pull request — a hierarchy of LangGraph agents for planning, programming, review, and E2E testing, built on LangChain's Open SWE. Executes code in isolated Daytona sandboxes and drives Playwright behind a human-in-the-loop gate.</p>
    <ul class="tags"><li>TypeScript</li><li>LangGraph</li><li>Next.js</li><li>GitHub App</li><li>Playwright</li><li>Docker</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/software-developer-agent" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="transformers" class="portfolio-item is-featured reveal">
  <a class="thumb placeholder" href="https://github.com/iliazlobin/transformers-labs" target="_blank" rel="noopener"><span>Transformer Fine-Tuning<br>LoRA · Quantization · GEC</span></a>
  <div class="body">
    <div class="yr-badge">2024</div>
    <h3>Transformers Fine-Tuning — LLM Research</h3>
    <p>A hands-on lab-book adapting transformer LLMs to grammatical error correction. ~35 notebooks fine-tune T5, BART, GPT-2, Phi-2, Gemma, and Llama-2 with LoRA and 4/8-bit quantization, scored through a reproducible ROUGE/SARI/SacreBLEU harness — LoRA lifts base T5-large from 0.36 to 0.89 ROUGE-1, all runnable on a single consumer GPU.</p>
    <ul class="tags"><li>PyTorch</li><li>Hugging Face</li><li>LoRA</li><li>BitsAndBytes</li><li>PEFT</li><li>Quantization</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/transformers-labs" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.youtube.com/watch?v=rY0f1GRK0h8" target="_blank" rel="noopener">▶ Research</a><a href="https://www.youtube.com/watch?v=k8XlLoGFIh0" target="_blank" rel="noopener">▶ Fine-Tuning</a></div>
  </div>
</article>

<article id="dspy" class="portfolio-item reveal">
  <a class="thumb" href="/images/dspy-demo-system-design.png" target="_blank" rel="noopener"><img src="/images/dspy-demo-system-design.png" alt="DSPy system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2024</div>
    <h3>DSPy — Declarative Language Programs</h3>
    <p>A research repo exploring DSPy, the framework that reframes prompt engineering as machine learning — declaring LLM pipelines as composable, trainable programs. Notebooks build, evaluate, and compile real pipelines for HumanEval code-gen, company valuation (RAG + LLM-as-judge), and multi-stage market analysis.</p>
    <ul class="tags"><li>Python</li><li>DSPy</li><li>RAG</li><li>LLM Evaluation</li><li>Jupyter</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/dspy-research" target="_blank" rel="noopener">GitHub ↗</a><a href="https://www.youtube.com/watch?v=NXI2l0wJNBY" target="_blank" rel="noopener">▶ Video</a></div>
  </div>
</article>

<article id="blog-summarizer" class="portfolio-item reveal">
  <a class="thumb" href="/images/blog-summarizer-system-design.png" target="_blank" rel="noopener"><img src="/images/blog-summarizer-system-design.png" alt="Cloud blog summarizer system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2024</div>
    <h3>Cloud Blog Summarizer — Full-Stack</h3>
    <p>A cloud-native SST monorepo that turns the firehose of AWS/Azure/GCP engineering blogs into a curated knowledge base. Apify crawls posts; an AWS Step Functions workflow dedupes, extracts, and summarizes each through a LangChain + OpenAI chain with typed structured output, publishing to Notion and a Next.js site.</p>
    <ul class="tags"><li>Next.js</li><li>Lambda</li><li>Step Functions</li><li>OpenAI</li><li>LangChain</li><li>Notion API</li><li>SST</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/iliazlobin-sst" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="personal-website" class="portfolio-item reveal">
  <a class="thumb" href="/images/personal-website-system-design.png" target="_blank" rel="noopener"><img src="/images/personal-website-system-design.png" alt="Personal website system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2024</div>
    <h3>Personal Website — Full-Stack</h3>
    <p>A modern Next.js frontend for the iliazlobin-sst cloud-automation platform — a fast, scalable interface for browsing summarized blog content and automation workflows, deployed on Vercel with Tailwind CSS.</p>
    <ul class="tags"><li>Next.js</li><li>React</li><li>TypeScript</li><li>Tailwind CSS</li><li>Vercel</li></ul>
    <div class="links"><a href="https://www.youtube.com/watch?v=171fy2U77iU&t=886s" target="_blank" rel="noopener">▶ Demo Video</a></div>
  </div>
</article>

<article id="atmos" class="portfolio-item is-featured reveal">
  <a class="thumb placeholder" href="https://github.com/iliazlobin/atmos-landing-zones" target="_blank" rel="noopener"><span>Atmos Landing Zones<br>AWS Multi-Account IaC</span></a>
  <div class="body">
    <div class="yr-badge">2023</div>
    <h3>Atmos Landing Zones — IaC</h3>
    <p>A production-style AWS Landing Zone as modular IaC with Cloud Posse Atmos, Terraform, and Helmfile. Vends a multi-account AWS Organization with SSO/SAML role delegation, segmented VPCs on a global Cloud WAN core, SCP-based guardrails, and centralized audit logging — all from a single stack tree inside a reproducible Geodesic shell.</p>
    <ul class="tags"><li>Terraform</li><li>Atmos</li><li>AWS</li><li>Cloud WAN</li><li>Helmfile</li><li>EKS</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/atmos-landing-zones" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="twitter-recsys" class="portfolio-item reveal">
  <a class="thumb" href="/images/twitter-recommendation-system-system-design.png" target="_blank" rel="noopener"><img src="/images/twitter-recommendation-system-system-design.png" alt="Twitter recommendation system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2023</div>
    <h3>Twitter Recommendation System — ML Research</h3>
    <p>An in-depth analysis of Twitter's open-sourced recommendation algorithm — RealGraph engagement prediction, MaskNet ranking, SimClusters community embeddings, and the TwHIN interaction graph — with walkthroughs of the official source code and the key papers.</p>
    <ul class="tags"><li>Python</li><li>Scala</li><li>Recommendation Systems</li><li>Graph ML</li></ul>
    <div class="links"><a href="https://www.youtube.com/watch?v=F-bvRXIQemg&t=418s" target="_blank" rel="noopener">▶ Video</a></div>
  </div>
</article>

<article id="voicematch-models" class="portfolio-item reveal">
  <a class="thumb" href="/images/voicematch-labs-system-design.png" target="_blank" rel="noopener"><img src="/images/voicematch-labs-system-design.png" alt="Voicematch Models system design" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2022</div>
    <h3>Voicematch Models — Speech/Audio ML</h3>
    <p>A speech/audio analysis toolkit and container suite for word, phoneme, and pitch evaluation. Ready-to-deploy Docker images and serving scripts with custom inference handlers for Wav2Vec2 (Hugging Face) and TensorFlow SPICE, targeting AWS SageMaker / TorchServe.</p>
    <ul class="tags"><li>Python</li><li>PyTorch</li><li>Hugging Face</li><li>TensorFlow</li><li>Docker</li><li>SageMaker</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/voicematch-labs/tree/master/voicematch-models" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

<article id="voicematch-app" class="portfolio-item reveal">
  <a class="thumb" href="/images/voicematch-labs-demo.png" target="_blank" rel="noopener"><img src="/images/voicematch-labs-demo.png" alt="VoiceMatch demo" loading="lazy"></a>
  <div class="body">
    <div class="yr-badge">2022</div>
    <h3>VoiceMatch — AI Pronunciation Platform</h3>
    <p>A full-stack, cloud-native English pronunciation coach that analyzes speech down to individual phonemes and its pitch contour, then visualizes it against a native-speaker reference. A Vue 3 frontend captures audio in-browser; a serverless AWS backend fans requests out to three ML inference services (Wav2Vec2, SPICE).</p>
    <ul class="tags"><li>Vue.js</li><li>TypeScript</li><li>Python</li><li>PyTorch</li><li>TensorFlow</li><li>AWS</li><li>Serverless</li></ul>
    <div class="links"><a class="gh" href="https://github.com/iliazlobin/voicematch-labs" target="_blank" rel="noopener">GitHub ↗</a></div>
  </div>
</article>

</div>
</div>
