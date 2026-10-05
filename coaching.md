---
layout: page
title: Staff+ engineering coaching
nav_title: Coaching
permalink: /coaching/
description: "One-on-one coaching for engineers working toward Staff, Staff+, and Principal roles — technical leadership, promotion, career decisions, and interview preparation."
---

<link rel="stylesheet" href="{{ '/assets/css/coaching.css' | relative_url }}?v={{ site.time | date: '%s' }}">

{%- comment -%}%20 rather than Liquid url_encode: that emits "+" for a space, which Gmail tolerates in a query string but mail clients paste literally into the subject line.{%- endcomment -%}
{%- assign mail_subject = "Coaching%20session" -%}
{%- capture gmail_url %}https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to={{ site.email }}&amp;su={{ mail_subject }}{% endcapture -%}
{%- capture mailto_url %}mailto:{{ site.email }}?subject={{ mail_subject }}{% endcapture -%}

<div class="coaching" markdown="1">

<p class="coaching-intro">I work one-on-one with engineers growing toward Staff, Staff+, and Principal roles.</p>

That might mean preparing for an interview loop, building a case for promotion, becoming more effective as a technical leader, or figuring out what is limiting your growth at the next level.

<div class="cta-row">
  <a class="btn btn-primary" href="{{ gmail_url }}" target="_blank" rel="noopener">Schedule via Gmail</a>
  <a class="btn" href="{{ mailto_url }}">Schedule via Mail app</a>
</div>

---

## What I can help with
{: #help }

<div class="track-grid">

  <div class="track-card">
    <h3>Career &amp; Staff+ growth</h3>
    <ul>
      <li>Moving from Senior to Staff, or Staff to Principal</li>
      <li>Building broader technical and organizational impact</li>
      <li>Promotion strategy and evidence</li>
      <li>Technical leadership without formal authority</li>
      <li>Communicating architecture and technical decisions</li>
      <li>Career transitions and evaluating opportunities</li>
    </ul>
  </div>

  <div class="track-card">
    <h3>Interview preparation</h3>
    <ul>
      <li>Coding</li>
      <li>System design</li>
      <li>ML system design</li>
      <li>Behavioral</li>
      <li>AI-enabled interviews</li>
      <li>Mock interviews and targeted feedback</li>
    </ul>
  </div>

</div>

---

## How it works
{: #how }

The first call is short and is for scoping — where you are and what you're working toward. After that we work the highest-leverage gaps first, and each session ends with concrete next steps.

---

## The judgment I look for at Staff+
{: #judgment }

Interviews compress Staff+ judgment into an hour, but the underlying behaviors are the same ones that matter on the job — in a design review, a promotion packet, or an interview loop.

<ol class="moves">
  <li><b>Scope with numbers.</b> Pin the problem to concrete quantities before proposing anything — users, requests per second, payload sizes, retention. Everything downstream is either justified by those numbers or is decoration.</li>
  <li><b>Name the crux.</b> State which single difficulty dominates the problem. Treating every requirement as equally hard shows you have not yet found the one that isn't.</li>
  <li><b>Cut what the crux does not need.</b> Remove every component that exists only for an easier sub-problem. Deleting a box from your own diagram is a stronger signal than adding one.</li>
  <li><b>Decide and say why.</b> Commit to one option. The rationale is part of the answer, not a footnote to it — an unresolved comparison of three databases is not a decision, in a design doc or in an interview.</li>
  <li><b>Attach a number to every claim.</b> If a statement carries weight, it carries a quantity or a derivation. "This won't scale" is an opinion; "this is 40k writes per second against a 10k-per-shard ceiling" is an argument.</li>
  <li><b>Plan for failure and change.</b> Say what breaks first under load and what you expect to evolve first under new requirements. Both answers should be specific enough to act on.</li>
  <li><b>State what you gave up.</b> Every chosen design has a cost. Naming it yourself, before you are asked, is the clearest evidence that the choice was made rather than defaulted into.</li>
</ol>

---

## What each interview round tests
{: #rounds }

Every round has a stated subject and an unstated one. The stated subject is the problem on the whiteboard. The unstated one is whether your judgment can be trusted on a problem nobody has solved yet.

<div class="round-grid">

  <div class="round-card">
    <h3>Coding</h3>
    <p>Not whether you have seen the problem, but whether you can move from a vague prompt to working code under observation: restate it, pick an approach and say why, implement it cleanly, then prove it runs on the cases that break it.</p>
    <p class="miss"><b>Where it is lost:</b> silence. Code that appears without narration reads as recall, not reasoning — and an untested solution reads as unfinished, however correct it is.</p>
  </div>

  <div class="round-card">
    <h3>System design</h3>
    <p>Whether you can hold an underspecified problem steady long enough to make decisions in it. Scope it with numbers, establish a baseline that works, then go deep where the numbers actually bite.</p>
    <p class="miss"><b>Where it is lost:</b> breadth as a substitute for depth — naming every component in the stack, committing to none of them, and never reaching the part of the problem that was hard.</p>
  </div>

  <div class="round-card">
    <h3>ML system design</h3>
    <p>The same discipline plus what is specific to learned systems: framing the task, choosing a metric that matches the business outcome, being honest about labels and training data, and designing for serving latency, drift, and retraining.</p>
    <p class="miss"><b>Where it is lost:</b> modeling in isolation — a strong architecture with no evaluation story, or an offline metric that nobody connects to the decision the product actually makes.</p>
  </div>

  <div class="round-card">
    <h3>Behavioral</h3>
    <p>Scope, judgment, and how you behave when things go wrong — read off concrete stories from your own work. At the Staff+ bar the interesting stories are rarely the successes; they are the calls made with incomplete information.</p>
    <p class="miss"><b>Where it is lost:</b> stories that stop at context and action. The impact and what you would do differently are the parts that carry the signal.</p>
  </div>

  <div class="round-card">
    <h3>AI-enabled rounds</h3>
    <p>Increasingly, an assistant is allowed — sometimes required. What is being watched is how you decompose the work, how precisely you direct the tool, how you verify what it hands back, and whether you can explain and own every line you submit.</p>
    <p class="miss"><b>Where it is lost:</b> accepting generated code you cannot defend. The tool being allowed never moves responsibility for the answer.</p>
  </div>

</div>

---

## Resources
{: #resources }

The design corpus on this site is written to the same bar I coach to — free to read, with or without a session:

- [**Design**](/designs/) — system and machine-learning architectures, from requirements through evaluation.
- [**Infrastructure**](/infrastructure/) — cloud platforms and technology deep dives into databases, messaging and orchestration.

</div>
