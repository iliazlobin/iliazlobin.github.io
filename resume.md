---
layout: page
title: Resume
permalink: /resume/
resume_updated: "2026-10-05"
description: "Ilia Zlobin — Staff Software Engineer with 14+ years of experience designing and building large-scale distributed systems, infrastructure platforms, developer tooling, and AI/ML systems."
---

<link rel="stylesheet" href="{{ '/assets/css/resume.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<div class="resume-layout">
<aside class="resume-sidebar" aria-label="Contact and qualifications">
  <section class="resume-section" id="contact" aria-label="Contact details">
    <div class="resume-profile">
      <p class="resume-location">
        <svg class="resume-profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
        <span>San Francisco Bay Area, CA</span>
      </p>
      <p class="resume-work-status">
        <svg class="resume-profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h3M7 14h2m5-1 2 2 3-4"/></svg>
        <span class="resume-work-status-badge">Green Card</span>
      </p>
    </div>
    <div class="resume-email">
      <button type="button" class="resume-email-copy" data-copy-email="iliazlobin91@gmail.com" aria-label="Copy email address" title="Copy email address">iliazlobin91@gmail.com</button>
      <a class="resume-gmail" href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=iliazlobin91%40gmail.com" target="_blank" rel="noopener" aria-label="Compose an email to Ilia in Gmail" title="Compose in Gmail">{% include gmail-icon.html %}</a>
      {% include resume-download.html icon_only=true %}
      <span class="resume-email-status" role="status"></span>
    </div>
    {% include social-links.html %}
  </section>
  <section class="resume-section" aria-labelledby="education">
    <h2 id="education">Education</h2>
    <p class="resume-degree"><strong>Computer Science</strong><span>Bachelor's degree · Honors · 2012</span></p>
    <p class="resume-school">St. Petersburg State Transport University</p>
  </section>
  <section class="resume-section resume-certifications" aria-labelledby="professional-certifications">
    <h2 id="professional-certifications">Certifications</h2>
    <ul class="resume-credentials">
      <li><span class="resume-caption">GCP · Professional</span><a href="https://www.credential.net/2f2ff049-fcd5-4f9e-8f64-68854117b9ad#acc.kl09iozI">Cloud Architect</a></li>
      <li>
        <span class="resume-caption">AWS · Professional</span>
        <a href="https://www.credly.com/badges/dc7ef41d-aa13-4d73-842f-fa1f051b1847">Solutions Architect</a>
        <a href="https://www.credly.com/badges/b7dde5e3-2593-4634-813f-9c3cd95b18e8">DevOps Engineer</a>
      </li>
      <li><span class="resume-caption">Microsoft Azure · Expert</span><a href="https://www.credly.com/badges/8dba540c-b86c-43e7-9cc3-d09839af19bb">Solutions Architect</a></li>
      <li><span class="resume-caption">Linux Foundation · CNCF</span><a href="https://www.credly.com/badges/d9d442b0-6ad1-4ce5-850e-28d8f4926e7b">Certified Kubernetes Administrator</a></li>
    </ul>
  </section>
</aside>
<div class="resume-main" markdown="1">

<header class="resume-summary-header">
  <h2 id="summary">Summary</h2>
  <p class="resume-updated">Updated <time datetime="{{ page.resume_updated }}">{{ page.resume_updated | date: '%b %-d, %Y' }}</time></p>
</header>

**Staff Software Engineer** with **14+ years of experience** designing and building large-scale distributed systems, infrastructure platforms, and developer tooling. I specialize in turning ambiguous, high-impact problems into scalable technical solutions—setting architecture and technical direction while staying deeply hands-on through prototyping, implementation, and production rollout.

My experience spans platform engineering, cloud infrastructure, developer productivity, and AI/ML systems, with a strong track record of leading multi-team initiatives, simplifying complex environments, and delivering measurable improvements in reliability, engineering velocity, and operational efficiency. Increasingly focused on applied AI and agentic systems, where I combine systems engineering, rapid technical discovery, and cross-functional collaboration to move ideas from early prototypes to production-scale solutions.

---

## Professional Experience

<ol class="resume-timeline" role="list" aria-label="Professional experience, most recent first">
<li class="resume-timeline-entry">
<article class="resume-role" aria-labelledby="meta--bay-area-ca-staff-software-engineer" markdown="1">
<header class="resume-role-header">
  <div>
    <h3 id="meta--bay-area-ca-staff-software-engineer">Meta</h3>
    <p class="resume-role-title">Staff Software Engineer</p>
    <p class="resume-role-location">Bay Area, CA</p>
  </div>
  <p class="resume-role-period"><time datetime="2026-03" title="March 2026">Mar 2026</time> <span aria-hidden="true">–</span> <time datetime="2026-09" title="September 2026">Sep 2026</time></p>
</header>

- Architected and built a large-scale infrastructure fulfillment simulation engine (Python/C++), running ~50,000 simulations per week to evaluate capacity-plan feasibility and robustness under supply and demand uncertainty.
- Designed a generalized scenario-modeling platform for capacity fulfillment, covering 3+ classes of planning scenarios and integrating with internal orchestration and UI workflows for end-to-end what-if analysis at production scale.
- Designed and built a Rust-based meta-harness unifying 3 coding-agent runtimes behind a common orchestration and control layer, enabling centralized management of concurrent AI-assisted engineering workflows.

</article>
</li>
<li class="resume-timeline-entry">
<article class="resume-role" aria-labelledby="mastercard--new-york-ny-principal-software-engineer" markdown="1">
<header class="resume-role-header">
  <div>
    <h3 id="mastercard--new-york-ny-principal-software-engineer">Mastercard</h3>
    <p class="resume-role-title">Principal Software Engineer</p>
    <p class="resume-role-location">New York, NY</p>
  </div>
  <p class="resume-role-period"><time datetime="2024-10" title="October 2024">Oct 2024</time> <span aria-hidden="true">–</span> <time datetime="2026-03" title="March 2026">Mar 2026</time></p>
</header>

- Architected an organization-wide access and permission management framework across 15 internal platforms and 10,000 users, establishing least-privilege IAM, policy-as-code guardrails, and access lifecycle management through GitOps.
- Led the re-architecture of the internal developer platform from a custom Java solution to Backstage, defining the target architecture and migration across 10 teams and 20+ systems while enabling governance of 20,000+ technical assets.
- Led hands-on redesign of company-wide developer onboarding across multiple platform teams, reducing onboarding time by ~80% and driving a 2× increase in portal registrations the following quarter.
- Designed a self-service ephemeral development environment platform, reducing prototyping time by 80% and accelerating feature delivery by 30%.

</article>
</li>
<li class="resume-timeline-entry">
<article class="resume-role" aria-labelledby="epam-systems--jersey-city-nj-systems-architect" markdown="1">
<header class="resume-role-header">
  <div>
    <h3 id="epam-systems--jersey-city-nj-systems-architect">EPAM Systems</h3>
    <p class="resume-role-title">Systems Architect</p>
    <p class="resume-role-location">Jersey City, NJ</p>
  </div>
  <p class="resume-role-period"><time datetime="2021-08" title="August 2021">Aug 2021</time> <span aria-hidden="true">–</span> <time datetime="2024-09" title="September 2024">Sep 2024</time></p>
</header>

- Designed and built a multi-tenant AWS Landing Zone infrastructure-management framework with Terraform/Spacelift, reducing setup time by 70% and ensuring SOC 2 compliance across 250+ accounts.
- Delivered a MySQL cloning solution (Go/Next.js) — a self-service portal for on-demand database clones handling 100+ daily clones, accelerating feature development by 80%.
- Authored the infrastructure and Kubernetes design for a GKE modernization factory, migrating 200 services over six months from GCE to a global, 2,000-node GKE platform across three regions.
- Spearheaded a GKE cost-optimization initiative via a metrics pipeline (Go, Cloud Functions) with automated analysis and rightsizing guardrails (HPA/non-HPA), achieving $1M+ in annual savings.
- Drove adoption of serverless patterns (Knative, Cloud Functions, Cloud Run), used by 10+ teams for operational workloads.
- Led an active-active disaster-recovery architecture with DynamoDB global tables and Step Functions, ensuring near-zero-downtime regional failover.
- Migrated 100 microservices (Python, Go) from GCP to AWS on a new EKS platform using Sceptre, CloudFormation, and FluxCD with Linkerd — adding OpenTelemetry instrumentation and MySQL replication for zero-downtime cutover.
- Designed a secure identity-federation pattern (Python) enabling critical financial applications in AWS to consume GCP services without static credentials, extending the model to authenticate GitHub Actions release pipelines.

</article>
</li>
<li class="resume-timeline-entry">
<article class="resume-role" aria-labelledby="epam-systems--minsk-belarus-lead-devops-engineer" markdown="1">
<header class="resume-role-header">
  <div>
    <h3 id="epam-systems--minsk-belarus-lead-devops-engineer">EPAM Systems</h3>
    <p class="resume-role-title">Lead DevOps Engineer</p>
    <p class="resume-role-location">Minsk, Belarus</p>
  </div>
  <p class="resume-role-period"><time datetime="2018-10" title="October 2018">Oct 2018</time> <span aria-hidden="true">–</span> <time datetime="2021-08" title="August 2021">Aug 2021</time></p>
</header>

- Built a multi-region Kubernetes platform (200+ microservices, Istio, GitOps), reducing deployment time by 80% and sustaining 99.99% availability.
- Implemented a multi-cloud landing zone with Cloud Posse Atmos for consistent provisioning across AWS, Azure, and GCP — 70% faster bootstrapping and unified management of 300+ accounts.
- Implemented a GitOps workflow with FluxCD and progressive delivery driven by Prometheus metrics, cutting deployment errors by 80% and improving lead time by 70%.
- Engineered a high-performance Terraform drift-detection system in Go, processing configurations across 200+ repositories and 1,000+ resources daily.
- Built an EKS platform with advanced observability (Prometheus/Grafana) and custom blue-green deployments, reducing MTTR by 60% and improving overall reliability by 40%.
- Designed a unified observability system (ELK stack with Prometheus/Grafana and APM), enabling DevOps KPIs and reducing MTTD by 50%.
- Developed a custom Kubernetes operator (Go) to automate database operations, reducing manual DBA intervention by 80% and improving database reliability.

</article>
</li>
<li class="resume-timeline-entry">
<article class="resume-role" aria-labelledby="niias--saint-petersburg-russia-software-developer" markdown="1">
<header class="resume-role-header">
  <div>
    <h3 id="niias--saint-petersburg-russia-software-developer">NIIAS</h3>
    <p class="resume-role-title">Software Developer</p>
    <p class="resume-role-location">Saint Petersburg, Russia</p>
  </div>
  <p class="resume-role-period"><time datetime="2012-10" title="October 2012">Oct 2012</time> <span aria-hidden="true">–</span> <time datetime="2018-08" title="August 2018">Aug 2018</time></p>
</header>

- Developed and maintained mission-critical railway-control embedded software in C++ on real-time Linux, sustaining 99.99% uptime for systems managing 1,000+ daily train operations; optimized core algorithms for a 40% CPU reduction and 50% faster response times.
- Led migration from a monolith to containerized microservices with Docker, improving deployment frequency by 300% and reducing time-to-market for new features by 50%.
- Established automated testing, raising code coverage from 60% to 95% and cutting post-release defects by 80%; introduced behavior-driven development (BDD) to improve developer–stakeholder collaboration.
- Engineered an embedded C++ video-streaming system for 100 trains on real-time Linux, delivering 720p@30fps with <1s p99 latency over 3G on constrained hardware.
- Built a centralized train-control-center application in C++/Qt for remote multi-train operation with telemetry visualization, predictive collision alarms, and digital location mapping.

</article>
</li>
</ol>

---

<section class="resume-talks" aria-labelledby="talks">
<header class="resume-projects-header">
  <h2 id="talks">Talks</h2>
</header>
<article class="resume-project resume-talk" aria-labelledby="resume-talk-dspy">
  <header class="resume-project-header">
    <p class="resume-talk-meta"><span class="resume-talk-event">PyData NYC</span><time datetime="2024-07-17">Jul 17, 2024</time></p>
    <h3 id="resume-talk-dspy">New Machine Learning Paradigm with DSPy: No Prompt Engineering Required</h3>
    <p class="resume-talk-venue">Microsoft Reactor · New York</p>
  </header>
  <p class="resume-project-description">Presented a hands-on approach to building and evaluating LLM pipelines with DSPy, covering retrieval-augmented generation, custom metrics, and automated optimization.</p>
  <footer class="resume-project-links">
    <a href="https://www.linkedin.com/posts/pydata-nyc_6-pydata-nycs-july-meetup-vector-databases-activity-7220890576542470144-6--_" aria-label="Event recap: DSPy at PyData NYC">Event recap<span aria-hidden="true">↗</span></a>
    <a href="https://docs.google.com/presentation/d/1xa-563pZ7tB7nGS5znxqMWy4wA4aVIKhgBqSU5Ofrus/edit?usp=drivesdk" aria-label="Slides: DSPy at PyData NYC">Slides<span aria-hidden="true">↗</span></a>
    <a href="https://github.com/iliazlobin/dspy-research" aria-label="Code: DSPy">Code<span aria-hidden="true">↗</span></a>
    <a href="https://www.youtube.com/watch?v=NXI2l0wJNBY" aria-label="Video walkthrough: DSPy">Video walkthrough<span aria-hidden="true">↗</span></a>
  </footer>
</article>
<article class="resume-project resume-talk" aria-labelledby="resume-talk-langchain">
  <header class="resume-project-header">
    <p class="resume-talk-meta"><span class="resume-talk-event">LangChain · Meetup</span><time datetime="2023-05-16">May 16, 2023</time></p>
    <h3 id="resume-talk-langchain">The Next Generation of GPT-Powered Apps with LangChain</h3>
    <p class="resume-talk-venue">Solas · New York</p>
  </header>
  <p class="resume-project-description">Introduced LangChain for building GPT-powered applications that answer questions over custom datasets, with examples of prompt engineering and data integration.</p>
  <footer class="resume-project-links">
    <a href="https://www.linkedin.com/events/newyorkaiusers-aitalks-demo-soc7056368880230760448" aria-label="LinkedIn event: LangChain meetup, May 16, 2023">LinkedIn event<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</section>

---

<section class="resume-projects" aria-labelledby="top-personal-projects-aiml-engineer--architect">
<header class="resume-projects-header">
  <h2 id="top-personal-projects-aiml-engineer--architect">Personal Projects</h2>
  <p class="resume-projects-meta"><span>AI/ML Engineer / Architect</span><span class="resume-projects-period"><time datetime="2018-12" title="December 2018">Dec 2018</time> – Present</span></p>
</header>
<ul class="resume-project-grid" role="list" aria-label="Personal projects">
<li class="resume-project-item resume-project-featured">
<article class="resume-project" aria-labelledby="resume-project-ai-events-concierge">
  <header class="resume-project-header">
    {% include project-labels.html type="full-stack" filter_page="/portfolio/" %}
    <h3 id="resume-project-ai-events-concierge">AI Events Concierge</h3>
  </header>
  <p class="resume-project-description">Designed and built an AI concierge for event discovery and registration using multi-agent workflows, automating search, ranking, form submission, and calendar integration for end-to-end scheduling with minimal human input.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/events-planner-agents" aria-label="GitHub: AI Events Concierge">GitHub<span aria-hidden="true">↗</span></a>
    <a href="https://www.youtube.com/watch?v=ORLfWH-2Zfc&amp;t=714s" aria-label="Video: AI Events Concierge">Video<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
<li class="resume-project-item">
<article class="resume-project" aria-labelledby="resume-project-event-ingestion-ranking-pipeline">
  <header class="resume-project-header">
    {% include project-labels.html type="infra" filter_page="/portfolio/" %}
    <h3 id="resume-project-event-ingestion-ranking-pipeline">Event Ingestion &amp; Ranking Pipeline</h3>
  </header>
  <p class="resume-project-description">Built a serverless data-processing platform (AWS/SST) for ingesting and ranking social events from crawlers, with hybrid search/ranking on OpenSearch and automated publishing to external platforms for analytics and real-time discovery at scale.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/events-planner-sst" aria-label="GitHub: Event Ingestion &amp; Ranking Pipeline">GitHub<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
<li class="resume-project-item">
<article class="resume-project" aria-labelledby="resume-project-dspy-declarative-language-programs">
  <header class="resume-project-header">
    {% include project-labels.html type="research" filter_page="/portfolio/" %}
    <h3 id="resume-project-dspy-declarative-language-programs">DSPy: Declarative Language Programs</h3>
  </header>
  <p class="resume-project-description">Explored DSPy, a framework for declarative LLM pipelines; built notebooks and demos for workflow orchestration, prompt optimization, and evaluation.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/dspy-research" aria-label="GitHub: DSPy: Declarative Language Programs">GitHub<span aria-hidden="true">↗</span></a>
    <a href="https://www.youtube.com/watch?v=NXI2l0wJNBY" aria-label="Video: DSPy: Declarative Language Programs">Video<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
<li class="resume-project-item">
<article class="resume-project" aria-labelledby="resume-project-speech-analysis-visualization-with-ml">
  <header class="resume-project-header">
    {% include project-labels.html type="full-stack" filter_page="/portfolio/" %}
    <h3 id="resume-project-speech-analysis-visualization-with-ml">Speech Analysis &amp; Visualization with ML</h3>
  </header>
  <p class="resume-project-description">Developed toolkits and full-stack applications for pronunciation and pitch analysis, deployed on AWS SageMaker and serverless backends, delivering real-time visual feedback to learners via modern web frontends.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/voicematch-labs" aria-label="GitHub: Speech Analysis &amp; Visualization with ML">GitHub<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
<li class="resume-project-item">
<article class="resume-project" aria-labelledby="resume-project-llm-fine-tuning">
  <header class="resume-project-header">
    {% include project-labels.html type="research" filter_page="/portfolio/" %}
    <h3 id="resume-project-llm-fine-tuning">LLM Fine-Tuning</h3>
  </header>
  <p class="resume-project-description">Explored optimization strategies for customizing transformer models — quantization, PEFT, and evaluation frameworks — delivering reproducible research workflows and benchmarks on GPU infrastructure.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/transformers-labs" aria-label="GitHub: LLM Fine-Tuning">GitHub<span aria-hidden="true">↗</span></a>
    <a href="https://www.youtube.com/watch?v=rY0f1GRK0h8" aria-label="Video: LLM Fine-Tuning">Video<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
<li class="resume-project-item">
<article class="resume-project" aria-labelledby="resume-project-cloud-service-providers-blog-summarizer">
  <header class="resume-project-header">
    {% include project-labels.html type="full-stack" filter_page="/portfolio/" %}
    <h3 id="resume-project-cloud-service-providers-blog-summarizer">Cloud Service Providers Blog Summarizer</h3>
  </header>
  <p class="resume-project-description">Built a cloud-native summarization pipeline integrating crawlers, LLMs, and AWS Step Functions, automating crawling, summarization, and publishing into Notion/Next.js applications with full infrastructure-as-code.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/iliazlobin-sst" aria-label="GitHub: Cloud Service Providers Blog Summarizer">GitHub<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
<li class="resume-project-item">
<article class="resume-project" aria-labelledby="resume-project-atmos-landing-zones">
  <header class="resume-project-header">
    {% include project-labels.html type="infra" filter_page="/portfolio/" %}
    <h3 id="resume-project-atmos-landing-zones">Atmos Landing Zones</h3>
  </header>
  <p class="resume-project-description">Built secure, scalable AWS Landing Zones with Cloud Posse Atmos, Terraform, and Helmfile — automating multi-account provisioning, IAM delegation, centralized networking, security guardrails, audit logging, and Kubernetes orchestration, with CI/CD and reproducible developer environments.</p>
  <footer class="resume-project-links">
    <a href="https://github.com/iliazlobin/atmos-landing-zones" aria-label="GitHub: Atmos Landing Zones">GitHub<span aria-hidden="true">↗</span></a>
  </footer>
</article>
</li>
</ul>
</section>

</div>
</div>
