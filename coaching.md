---
layout: page
title: Coaching
permalink: /coaching/
description: "One-on-one interview coaching for software, ML, and AI engineering roles by Ilia Zlobin — what each round actually tests, the judgment it is graded on, how sessions work, and how to get in touch."
---

<link rel="stylesheet" href="{{ '/assets/css/coaching.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<div class="coaching" markdown="1">

<p class="coaching-intro">I coach engineers one-on-one through the rounds these roles are decided by — coding, system design, ML system design, behavioral, and AI-enabled interviews. Sessions are built on material I wrote and used myself, most of it published on this site in full.</p>

I'm a Principal/Staff Software Engineer with 14+ years on distributed systems, Kubernetes and multi-cloud platforms, and AI/ML infrastructure — currently at Meta, previously Mastercard and EPAM. Full history is on my [**Resume**](/resume/).

The rest of this page is worth reading whether or not we ever talk: what each round is actually scored on, and the handful of judgment calls that separate a pass from a strong hire across all of them.

<div class="cta-row">
  <a class="btn btn-primary" href="mailto:{{ site.email }}?subject=Interview%20coaching">Email me</a>
  <a class="btn" href="#rounds">What each round tests</a>
</div>

---

## What each round tests
{: #rounds }

Every round has a stated subject and an unstated one. The stated subject is the problem on the whiteboard. The unstated one is whether your judgment can be trusted on a problem nobody has solved yet — and that is what the score is really for.

<div class="round-grid">

  <div class="round-card">
    <h3>Coding</h3>
    <p>Not whether you have seen the problem, but whether you can move from a vague prompt to working code under observation: restate the problem, pick an approach and say why, implement it cleanly, then prove it runs on the cases that break it.</p>
    <p class="miss"><b>Where it is lost:</b> silence. Code that appears without narration reads as recall, not reasoning — and an untested solution reads as unfinished, however correct it is.</p>
  </div>

  <div class="round-card">
    <h3>System design</h3>
    <p>Whether you can hold an underspecified problem steady long enough to make decisions in it. Scope it with numbers, establish a baseline that works, then go deep on the one or two places where the numbers actually bite.</p>
    <p class="miss"><b>Where it is lost:</b> breadth as a substitute for depth — naming every component in the stack, committing to none of them, and never reaching the part of the problem that was hard.</p>
  </div>

  <div class="round-card">
    <h3>ML system design</h3>
    <p>The same discipline plus the parts that are specific to learned systems: framing the task, choosing a metric that matches the business outcome, being honest about labels and training data, and designing for serving latency, drift, and retraining.</p>
    <p class="miss"><b>Where it is lost:</b> modeling in isolation — a strong architecture with no evaluation story, or an offline metric that nobody connects to the decision the product actually makes.</p>
  </div>

  <div class="round-card">
    <h3>Behavioral</h3>
    <p>Scope, judgment, and how you behave when things go wrong — read off concrete stories from your own work. At the staff bar the interesting stories are rarely the successes; they are the calls made with incomplete information.</p>
    <p class="miss"><b>Where it is lost:</b> stories that stop at context and action. The impact and what you would do differently are the parts that carry the signal.</p>
  </div>

  <div class="round-card">
    <h3>AI-enabled rounds</h3>
    <p>Increasingly, an assistant is allowed — sometimes required. What is being watched is how you decompose the work, how precisely you direct the tool, how you verify what it hands back, and whether you can explain and own every line you submit.</p>
    <p class="miss"><b>Where it is lost:</b> accepting generated code you cannot defend. The tool being allowed never moves responsibility for the answer.</p>
  </div>

</div>

---

## The judgment every round is graded on

Across coding, design, and behavioral rounds, strong candidates keep performing the same seven moves. They are the most portable thing I can hand anyone, so they are on this page rather than behind a session.

<ol class="moves">
  <li><b>Scope with numbers.</b> Pin the problem to concrete quantities before proposing anything — users, requests per second, payload sizes, retention. Everything downstream is either justified by those numbers or is decoration.</li>
  <li><b>Name the crux.</b> State which single difficulty dominates the problem. A design that treats every requirement as equally hard shows you have not found the one that isn't.</li>
  <li><b>Cut what the crux does not need.</b> Remove every component that exists only for an easier sub-problem. Deleting a box from your own diagram is a stronger signal than adding one.</li>
  <li><b>Decide and say why.</b> Commit to one option. The rationale is part of the answer, not a footnote to it — an unresolved comparison of three databases scores as no decision at all.</li>
  <li><b>Attach a number to every claim.</b> If a statement carries weight, it carries a quantity or a derivation. "This won't scale" is an opinion; "this is 40k writes per second against a 10k-per-shard ceiling" is an argument.</li>
  <li><b>Plan for failure and change.</b> Say what breaks first under load and what you expect to evolve first under new requirements. Both answers should be specific enough to act on.</li>
  <li><b>State what you gave up.</b> Every chosen design has a cost. Naming it yourself, before you are asked, is the clearest evidence that the choice was made rather than defaulted into.</li>
</ol>

---

## How sessions work

The first call is short and is for scoping — your target roles, your timeline, and where preparation actually stands. Nothing to prepare for it.

After that, sessions run one of two ways. A **mock round** is the real thing end to end, at interview pace, followed by feedback against the same bar above — what scored, what didn't, what an interviewer would have written down. A **working session** takes one specific gap — a pattern you keep missing, a design you can't scope, a story that isn't landing — and we fix it directly.

You leave each session with a written plan: what to work on next, in what order, and how to tell when it's done. Between sessions, the material below is yours to work through at your own pace.

Sessions are arranged over email. Tell me the roles you're targeting, your timeline, and where you think the gaps are, and I'll come back with a plan and rates.

---

## What the sessions are built on

The published corpus on this site is the same material the sessions work from — free to read, with or without a session:

- [**System design**](/designs/) — 34 full design documents, all written to one method, diagrams included.
- [**ML system design**](/machine-learning/) — 12 documents covering framing, metrics, training data, and serving.
- [**Infrastructure**](/infrastructure/) — 6 end-to-end builds on AWS, GCP, and bare-metal Kubernetes.
- [**Tech deep dives**](/tech/) — 17 studies of the systems those designs are built on: Kafka, Postgres, Cassandra, Redis, Flink, and more.

Alongside it I keep a private corpus of 500+ verified Python solutions organized by pattern — each one shipped with its own executed tests — plus role roadmaps for software, ML, and AI engineering. Those come into the sessions directly.

---

## Availability

<div class="avail">
  <div><span class="days">Monday – Thursday</span><span class="hours">6:00 – 10:00 PM</span></div>
  <div><span class="days">Saturday – Sunday</span><span class="hours">12:00 – 10:00 PM</span></div>
</div>

<p class="avail-note">Times are US Pacific. Outside those hours, say what works in your timezone and I'll try to meet it.</p>

---

## Get in touch

<div class="contact-card" markdown="1">

The fastest route is email. Include your target roles, your timeline, and two or three slots that work for you — I usually reply within a day.

<div class="cta-row">
  {%- if site.booking_url and site.booking_url != "" %}
  <a class="btn btn-primary" href="{{ site.booking_url }}">Book a session</a>
  {%- endif %}
  <a class="btn{% if site.booking_url == "" %} btn-primary{% endif %}" href="mailto:{{ site.email }}?subject=Interview%20coaching">{{ site.email }}</a>
  <a class="btn" href="https://www.linkedin.com/in/{{ site.linkedin_username }}" target="_blank" rel="noopener">LinkedIn ↗</a>
  <a class="btn" href="https://x.com/{{ site.twitter_username }}" target="_blank" rel="noopener">X ↗</a>
</div>

</div>

</div>
