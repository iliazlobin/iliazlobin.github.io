---
layout: page
title: Portfolio
permalink: /portfolio/
---

<link rel="stylesheet" href="/assets/portfolio-grid.css">

<div class="portfolio-grid">

<div class="portfolio-item">
  <h3>AI Events concierge (Full-Stack Agentic System)</h3>
  <a href="/images/events-planner-agent-system-design.png" target="_blank"><img src="/images/events-planner-agent-system-design.png" alt="Event Concierge System Design"></a>
  <p>End-to-end automation for event discovery, registration, and calendar scheduling. Powered by <a href="https://langchain-ai.github.io/langgraph/" target="_blank">LangGraph</a>, <a href="https://microsoft.github.io/autogen/" target="_blank">AutoGen</a>, and browser automation, it acts as a personal concierge—searching, ranking, registering, and scheduling events from platforms like Meetup and Luma. The system orchestrates multiple AI agents and browser automation (<a href="https://playwright.dev/" target="_blank">Playwright</a>, AutoGen) to handle form filling, event registration, and <a href="https://developers.google.com/calendar/api" target="_blank">Google Calendar API</a> integration. State management ensures user info and event status are tracked throughout the workflow, keeping your schedule up to date automatically.</p>
  <em>Technologies: Python, <a href="https://langchain-ai.github.io/langgraph/" target="_blank">LangGraph</a>, <a href="https://microsoft.github.io/autogen/" target="_blank">AutoGen</a>, <a href="https://playwright.dev/" target="_blank">Playwright</a>, <a href="https://developers.google.com/calendar/api" target="_blank">Google Calendar API</a>, Browser Automation</em>
  <a href="https://github.com/iliazlobin/events-planner-agents">GitHub Repository</a>
  <a href="https://www.youtube.com/watch?v=ORLfWH-2Zfc&t=714s&ab_channel=IliaZlobin">YouTube Walkthrough</a>
</div>

<div class="portfolio-item">
  <h3>Event ingestion and ranking pipeline (Full-Stack Project)</h3>
  <a href="/images/events-planner-ingest-system-design.png" target="_blank"><img src="/images/events-planner-ingest-system-design.png" alt="Event Ingestion System Design"></a>
  <p>Cloud-native, serverless platform for ingesting, enriching, and ranking event data from diverse sources (e.g., <a href="https://apify.com/" target="_blank">Apify</a> crawlers via webhooks). Built with <a href="https://sst.dev/" target="_blank">SST</a> and <a href="https://aws.amazon.com/" target="_blank">AWS</a>, it features modular <a href="https://aws.amazon.com/lambda/" target="_blank">Lambda</a> functions, <a href="https://aws.amazon.com/dynamodb/" target="_blank">DynamoDB</a> storage, <a href="https://opensearch.org/" target="_blank">OpenSearch</a> indexing, and automated publishing to external platforms (Bluesky, Twitter). Supports hybrid search, analytics dashboards, and extensible integrations (<a href="https://openai.com/" target="_blank">OpenAI</a>, Apify). Designed for reliability, scalability, and research-driven workflows, with infrastructure-as-code and CI/CD automation.</p>
  <em>Technologies: TypeScript, <a href="https://sst.dev/" target="_blank">SST</a>, <a href="https://aws.amazon.com/lambda/" target="_blank">AWS Lambda</a>, <a href="https://aws.amazon.com/dynamodb/" target="_blank">DynamoDB</a>, <a href="https://opensearch.org/" target="_blank">OpenSearch</a>, <a href="https://apify.com/" target="_blank">Apify</a>, <a href="https://openai.com/" target="_blank">OpenAI</a>, <a href="https://aws.amazon.com/step-functions/" target="_blank">Step Functions</a>, CI/CD</em>
  <a href="https://github.com/iliazlobin/events-planner-sst">GitHub Repository</a>
</div>

<div class="portfolio-item">
  <h3>DSPy: Declarative Language Programs (AI/ML Research)</h3>
  <a href="/images/dspy-demo-system-design.png" target="_blank"><img src="/images/dspy-demo-system-design.png" alt="DSPy System Design"></a>
  <p>Comprehensive resource for experimenting with <a href="https://github.com/stanfordnlp/dspy" target="_blank">DSPy</a>—a framework for declarative, trainable language model pipelines. Includes code, Jupyter notebooks, demos, and documentation for evaluating, orchestrating, and optimizing LLM workflows. DSPy reframes prompt engineering as a machine learning problem, enabling systematic evaluation, reproducibility, and scalable pipeline design. Key features: modular pipeline composition, automated prompt and parameter optimization, and robust evaluation using datasets and metrics. Demos illustrate basic, compiled, and multi-stage DSPy workflows for company and market analysis.</p>
  <a href="https://github.com/iliazlobin/dspy-research">GitHub Repository</a>
  <a href="https://www.youtube.com/watch?v=NXI2l0wJNBY&ab_channel=IliaZlobin">YouTube Walkthrough</a>
</div>

<div class="portfolio-item">
  <h3>Cloud Service Providers Blogs Summarizator (Full-Stack Project)</h3>
  <a href="/images/blog-summarizer-system-design.png" target="_blank"><img src="/images/blog-summarizer-system-design.png" alt="Blog Summarizer System Design"></a>
  <p>Cloud-native automation for blog summarization and content management, leveraging <a href="https://aws.amazon.com/step-functions/" target="_blank">AWS Step Functions</a>, <a href="https://aws.amazon.com/lambda/" target="_blank">Lambda</a>, <a href="https://openai.com/" target="_blank">OpenAI</a>, <a href="https://www.notion.so/product/api" target="_blank">Notion API</a>, and <a href="https://apify.com/" target="_blank">Apify</a>. Crawls, summarizes, and organizes blog content using serverless architecture and LLMs. Features include automated blog summarization (<a href="https://openai.com/" target="_blank">OpenAI</a>, <a href="https://www.langchain.com/" target="_blank">LangChain</a>), scalable content crawling (Apify), secure API endpoints, <a href="https://nextjs.org/" target="_blank">Next.js</a> frontend, and infrastructure as code (<a href="https://sst.dev/" target="_blank">SST</a>, <a href="https://docs.aws.amazon.com/cdk/latest/guide/home.html" target="_blank">AWS CDK</a>). Extensible to multi-cloud environments and CI/CD ready.</p>
  <em>Technologies: <a href="https://nextjs.org/" target="_blank">Next.js</a>, <a href="https://aws.amazon.com/lambda/" target="_blank">AWS Lambda</a>, <a href="https://aws.amazon.com/step-functions/" target="_blank">Step Functions</a>, <a href="https://openai.com/" target="_blank">OpenAI</a>, <a href="https://www.langchain.com/" target="_blank">LangChain</a>, <a href="https://apify.com/" target="_blank">Apify</a>, <a href="https://www.notion.so/product/api" target="_blank">Notion API</a>, <a href="https://sst.dev/" target="_blank">SST</a>, <a href="https://docs.aws.amazon.com/cdk/latest/guide/home.html" target="_blank">AWS CDK</a></em>
  <a href="https://github.com/iliazlobin/iliazlobin-sst">GitHub Repository</a>
</div>

<div class="portfolio-item">
  <h3>Personal Website (Full-Stack Project)</h3>
  <a href="/images/personal-website-system-design.png" target="_blank"><img src="/images/personal-website-system-design.png" alt="Personal Website System Design"></a>
  <p>Modern web application built with <a href="https://nextjs.org/" target="_blank">Next.js</a>, serving as the frontend for iliazlobin-sst cloud automation and blog summarization platform. Provides a fast, scalable interface for viewing and managing summarized blog content and automation workflows. Features include modular app directory structure, live reload, font optimization, custom API integration, <a href="https://vercel.com/" target="_blank">Vercel</a> deployment, TypeScript, and <a href="https://tailwindcss.com/" target="_blank">Tailwind CSS</a>.</p>
  <em>Technologies: <a href="https://nextjs.org/" target="_blank">Next.js</a>, <a href="https://react.dev/" target="_blank">React</a>, TypeScript, <a href="https://tailwindcss.com/" target="_blank">Tailwind CSS</a>, <a href="https://vercel.com/" target="_blank">Vercel</a>, <a href="https://sst.dev/" target="_blank">SST</a>, API integration</em>
  <a href="https://www.youtube.com/watch?v=171fy2U77iU&t=886s&ab_channel=IliaZlobin">Demo Video</a>
</div>

<div class="portfolio-item">
  <h3>Transformers Fine-Tuning (LLM Research)</h3>
  <p>Comprehensive exploration of transformer model fine-tuning, focusing on grammar tasks and optimization strategies. Covers theoretical foundations, architectural considerations, and practical techniques for customizing models like <a href="https://huggingface.co/docs/transformers/model_doc/t5" target="_blank">T5</a>, <a href="https://huggingface.co/docs/transformers/model_doc/gpt2" target="_blank">GPT-2</a>, and <a href="https://huggingface.co/meta-llama" target="_blank">Llama-2</a>. Demonstrates evaluation frameworks, metrics (perplexity), and hardware-efficient methods (<a href="https://github.com/huggingface/peft" target="_blank">PEFT</a>, <a href="https://github.com/microsoft/LoRA" target="_blank">LoRA</a>, <a href="https://github.com/TimDettmers/bitsandbytes" target="_blank">BitsAndBytes</a>, soft prompts). Includes hands-on walkthroughs using <a href="https://jupyter.org/" target="_blank">Jupyter</a> notebooks and <a href="https://github.com/OpenAccess-AI-Collective/axolotl" target="_blank">Axolotl</a>, with source code for evaluation, fine-tuning, and infrastructure.</p>
  <em>Technologies: Python, <a href="https://pytorch.org/" target="_blank">PyTorch</a>, <a href="https://huggingface.co/docs/transformers/index" target="_blank">Hugging Face Transformers</a>, <a href="https://github.com/microsoft/LoRA" target="_blank">LoRA</a>, <a href="https://github.com/TimDettmers/bitsandbytes" target="_blank">BitsAndBytes</a>, <a href="https://github.com/OpenAccess-AI-Collective/axolotl" target="_blank">Axolotl</a>, <a href="https://jupyter.org/" target="_blank">Jupyter</a>, Model Evaluation, Cloud Infrastructure</em>
  <a href="https://www.youtube.com/watch?v=rY0f1GRK0h8&ab_channel=IliaZlobin">Transformer Research Video</a>
  <a href="https://www.youtube.com/watch?v=k8XlLoGFIh0&t=2s&ab_channel=IliaZlobin">Fine Tuning Video</a>
  <a href="https://github.com/iliazlobin/transformers-labs">GitHub Repository</a>
</div>

<div class="portfolio-item">
  <h3>Twitter Recommendation System (ML Research)</h3>
  <a href="/images/twitter-recommendation-system-system-design.png" target="_blank"><img src="/images/twitter-recommendation-system-system-design.png" alt="Twitter Recommendation System Design"></a>
  <p>In-depth analysis of Twitter's open-sourced recommendation algorithm, exploring its system design, technical documentation, and key scientific papers. The video covers how Twitter ranks and recommends tweets, the role of user engagement prediction (RealGraph), feature-wise multiplication in ranking models (MaskNet), community-based representations (SimClusters), and multimodal interaction graphs (TwHIN). Includes walkthroughs of official source code, technical docs, and practical insights for users and content creators. See <a href="https://github.com/twitter/the-algorithm" target="_blank">Twitter's open-source algorithm</a>.</p>
  <em>Technologies: Python, Scala, Machine Learning, Graph Algorithms, Recommendation Systems, <a href="https://developer.twitter.com/en/docs/twitter-api" target="_blank">Twitter API</a></em>
  <a href="https://www.youtube.com/watch?v=F-bvRXIQemg&t=418s&ab_channel=IliaZlobin">YouTube Video</a>
</div>

<div class="portfolio-item">
  <h3>Atmos Landing Zones (IaC Project)</h3>
  <p>Comprehensive implementation of AWS Landing Zones using <a href="https://github.com/cloudposse/atmos" target="_blank">Cloud Posse Atmos</a>, <a href="https://www.terraform.io/" target="_blank">Terraform</a>, and <a href="https://github.com/helmfile/helmfile" target="_blank">Helmfile</a>. Enables secure, scalable, and automated provisioning of multi-account, multi-region AWS environments with modular infrastructure as code. Features include automated account creation, IAM role delegation (SSO/SAML), centralized networking, security guardrails, audit logging, and Kubernetes orchestration. Supports CI/CD automation, reproducible developer environments (<a href="https://github.com/cloudposse/geodesic" target="_blank">Geodesic shell</a>), and extensible configuration for business units and future cloud providers.</p>
  <em>Technologies: <a href="https://github.com/cloudposse/atmos" target="_blank">Atmos</a>, <a href="https://www.terraform.io/" target="_blank">Terraform</a>, <a href="https://github.com/helmfile/helmfile" target="_blank">Helmfile</a>, <a href="https://aws.amazon.com/" target="_blank">AWS</a>, SSO, SAML, <a href="https://github.com/cloudposse/geodesic" target="_blank">Geodesic</a>, CI/CD, <a href="https://www.docker.com/" target="_blank">Docker</a></em>
  <a href="https://github.com/iliazlobin/atmos-landing-zones">GitHub Repository</a>
</div>

<div class="portfolio-item">
  <h3>Voicematch Models: Speech & Audio Analysis Toolkit (ML Research)</h3>
  <a href="/images/voicematch-labs-system-design.png" target="_blank"><img src="/images/voicematch-labs-system-design.png" alt="Voicematch Models System Design"></a>
  <p>Toolkit and container suite for advanced speech/audio analysis, including word, phoneme, and pitch evaluation. Provides ready-to-deploy <a href="https://www.docker.com/" target="_blank">Docker</a> images, model artifacts, and serving scripts for local/cloud deployment (<a href="https://aws.amazon.com/sagemaker/" target="_blank">AWS SageMaker</a>, <a href="https://pytorch.org/serve/" target="_blank">TorchServe</a>). Features custom Python inference handlers for <a href="https://huggingface.co/docs/transformers/index" target="_blank">Hugging Face Transformers</a> (Wav2Vec2) and <a href="https://www.tensorflow.org/hub/tutorials/spice" target="_blank">TensorFlow SPICE</a>, flexible configuration, and utilities for local validation.</p>
  <em>Technologies: Python, <a href="https://pytorch.org/" target="_blank">PyTorch</a>, <a href="https://huggingface.co/docs/transformers/index" target="_blank">Hugging Face</a>, <a href="https://www.tensorflow.org/" target="_blank">TensorFlow</a>, <a href="https://www.docker.com/" target="_blank">Docker</a>, <a href="https://pytorch.org/serve/" target="_blank">TorchServe</a>, <a href="https://aws.amazon.com/sagemaker/" target="_blank">AWS SageMaker</a></em>
  <a href="https://github.com/iliazlobin/voicematch-labs/tree/master/voicematch-models">GitHub Repository</a>
</div>

<div class="portfolio-item">
  <h3>VoiceMatch: AI-Powered English Pronunciation Practice Platform (Full-Stack Project)</h3>
  <a href="/images/voicematch-labs-system-design.png" target="_blank">
    <img src="/images/voicematch-labs-system-design.png" alt="VoiceMatch System Design">
  </a>
  <p>Designed and implemented a full-stack, cloud-native application enabling users to improve English pronunciation through advanced speech analysis and interactive feedback. Architected scalable backend APIs, developed modern <a href="https://vuejs.org/" target="_blank">Vue.js</a> and <a href="https://react.dev/" target="_blank">React</a> frontends, and integrated machine learning models (<a href="https://pytorch.org/" target="_blank">PyTorch</a>, <a href="https://www.tensorflow.org/" target="_blank">TensorFlow</a>) for phoneme and pitch detection. Leveraged <a href="https://aws.amazon.com/s3/" target="_blank">AWS S3</a>, <a href="https://www.docker.com/" target="_blank">Docker</a>, and serverless technologies for robust cloud video/audio processing. Delivered real-time, data-driven insights and visualizations, supporting both individual learners and educational institutions.</p>
  <a href="/images/voicematch-labs-demo.png" target="_blank">
    <img src="/images/voicematch-labs-demo.png" alt="VoiceMatch Demo">
  </a>
  <em>Technologies: Python, TypeScript, <a href="https://vuejs.org/" target="_blank">Vue.js</a>, <a href="https://react.dev/" target="_blank">React</a>, <a href="https://aws.amazon.com/" target="_blank">AWS</a>, <a href="https://www.docker.com/" target="_blank">Docker</a>, <a href="https://pytorch.org/" target="_blank">PyTorch</a>, <a href="https://www.tensorflow.org/" target="_blank">TensorFlow</a>, Serverless.</em>
  <a href="https://github.com/iliazlobin/voicematch-labs">GitHub Repository</a>
</div>

</div>

<hr />
