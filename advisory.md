---
layout: page
title: Advisory
permalink: /advisory/
description: "Systems and cloud architecture, AI/ML engineering, technical leadership and professional growth for founders, engineering teams and individual engineers."
---

<link rel="stylesheet" href="{{ '/assets/css/advisory.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<section class="advisory" aria-labelledby="advisory-focus">
  <h2 id="advisory-focus" class="advisory-headline">
    <span>Technical Leadership &amp; Professional Growth</span>
    <span>Systems Designs &amp; Cloud Architecture</span>
    <span>AI/ML Engineering</span>
  </h2>
  <p class="advisory-lead">I help founders, startups, and engineering teams design, build, and scale reliable software systems and AI-powered products. I also help individual engineers strengthen their technical expertise, develop leadership skills, and advance their careers.</p>
  <p>My expertise spans <strong>system design, distributed systems, cloud infrastructure, and AI/ML engineering</strong>—from architecture reviews and scalability challenges to LLM applications, AI agents, model serving, and production infrastructure.</p>
  <ul class="advisory-areas">
    <li><strong>Systems &amp; Cloud Architecture:</strong> System design, architecture reviews, distributed systems, scalability, reliability, performance optimization, and cloud infrastructure.</li>
    <li><strong>AI/ML Engineering:</strong> LLM applications, AI agents, RAG, model serving, ML infrastructure, and taking AI prototypes into production.</li>
    <li><strong>Technical Strategy:</strong> Technology selection, architecture tradeoffs, technical feasibility, cloud cost optimization, modernization, and engineering roadmaps.</li>
    <li><strong>Technical Leadership &amp; Professional Growth:</strong> Engineering mentorship, system design and interview preparation, technical decision-making, leadership development, and career progression into senior, staff, and principal engineering roles.</li>
  </ul>
  <ul class="social-links advisory-contact" aria-label="Connect with Ilia">
    {% if site.advisory_booking_url and site.advisory_booking_url != "" %}
    <li><a href="{{ site.advisory_booking_url }}" target="_blank" rel="noopener" aria-label="Schedule a call" title="Schedule a call"><svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M5 4h1V2h2v2h8V2h2v2h1a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm-1 6v10h16V10H4Zm3 3h3v3H7v-3Zm7 0h3v3h-3v-3Z"></path></svg></a></li>
    {% endif %}
    <li><a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to={{ site.email | uri_escape }}&amp;su=Technical%20advisory" target="_blank" rel="noopener" aria-label="Compose an email to Ilia in Gmail" title="Gmail">{% include gmail-icon.html %}</a></li>
    <li><a href="https://x.com/iliazlobin" target="_blank" rel="noopener" aria-label="X" title="X"><svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg></a></li>
    <li><a href="https://www.linkedin.com/in/iliazlobin" target="_blank" rel="noopener" aria-label="LinkedIn" title="LinkedIn"><svg class="social-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="{{ '/assets/minima-social-icons.svg' | relative_url }}#linkedin"></use></svg></a></li>
  </ul>
</section>
