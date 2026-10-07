---
layout: post
title: "ML: Harmful-Content Detection"
category: system-design-ml
date: 2026-07-08
tags: [Machine-Learning, Classification, Content-Moderation]
thumbnail: /images/posts/harmful-content-detection.svg
last_modified_at: 2026-10-06
description: "Design of a moderation service that identifies policy-violating posts and applies versioned enforcement decisions."
notion_source: https://app.notion.com/p/397d865005a881f186e7f7f6aae1f5f2
---

Design of a moderation service that identifies policy-violating posts and applies versioned enforcement decisions.

<!--more-->

## Problem

A social platform needs to reduce users' exposure to harmful content while preserving legitimate posts. A post may combine text, images and video, and its meaning can depend on how those parts relate.

The service evaluates new content, routes uncertain cases to reviewers and re-evaluates posts as reports or other evidence arrive. Model scores inform decisions; the policy service determines which action is permitted for each category.

## Requirements

### Functional requirements

- **Evaluate posts:** score supported text, image and recorded-video content against policy categories.
- **Apply enforcement:** allow, limit distribution, quarantine for review or remove a post according to policy.
- **Re-evaluate content:** incorporate new reports, behavioral evidence and revised policy.
- **Support review:** retain decision reasons, model/policy versions and reviewer corrections.
- **Measure impact:** track harmful-content exposure and mistaken enforcement by category and language.

Live-stream moderation, advertiser-specific policies and reviewer-interface design are separate systems.

### Non-functional requirements

- **Scale:** assume 1B posts/day and 35K upload evaluations/s at peak.
- **Latency:** target p99 below 200ms for supported bounded text/image requests. Longer video analysis runs asynchronously.
- **Quality:** target at least 95% precision for automated removal on an independently reviewed sample, with category-specific recall and false-positive limits.
- **Freshness:** refresh behavioral features within minutes; evaluate threshold updates when enough mature labels exist.
- **Reliability:** persist enforcement decisions before acknowledging them; retain the last approved model during failed releases.
- **Privacy:** restrict raw-content/reviewer access and apply retention, deletion and evidence-handling controls.

## Back-of-the-envelope calculations

- `1B / 86,400 ≈ 11.6K posts/s` on average; 35K/s is approximately a threefold peak.
- If 5% require the heavy model, it receives about 580/s on average and 1,750/s at peak. This is a routing assumption to validate against recall.
- At an assumed 1KB decision/feature reference per post, metadata adds about 1TB/day before replicas; raw media is accounted for separately.
- If prevalence were 1%, 95% removal precision would still allow many mistaken removals. Precision, coverage and exposure must be reported together.

## Core entities

- **Post version:** immutable content identity and modality references.
- **Assessment:** category scores and the features/models used to compute them.
- **Policy decision:** the current enforceable action for that post version.
- **Review label:** a human judgment with provenance and label-availability time.

```protobuf
message PostVersion {
  string post_id;
  string content_version;
  string author_id;
  string text;
  repeated string media_refs;
  Timestamp created_at;
}

message Assessment {
  string assessment_id;
  string post_id;
  string content_version;
  map<string, float> category_scores;
  string model_version;
  string feature_version;
}

message PolicyDecision {
  string post_id;
  string content_version;
  string action; // Allow, demote, quarantine or remove
  string policy_version;
  string decision_version; // Monotonic per post
  repeated string reason_codes;
}

message ReviewLabel {
  string post_id;
  string content_version;
  map<string, bool> violations;
  string label_source;
  Timestamp available_at;
}
```

Scores and actions are separate records. A reviewer correction can update the policy decision without changing the original assessment.

## API

```yaml
POST /v1/moderation/assessments:
  headers:
    Idempotency-Key: post-7-version-3
  body:
    post_id: post-7
    content_version: "3"
    text: content
    media_refs: [object-reference]
  response:
    assessment_id: assessment-123
    action: quarantine
    decision_version: "12"
    reason_codes: [review_required]

GET /v1/moderation/posts/{post_id}/decision:
  response:
    content_version: "3"
    action: quarantine
    policy_version: policy-8

POST /v1/moderation/reviews:
  body:
    review_id: review-123
    assessment_id: assessment-123
    violations: {category: false}
```

Only authorized internal services submit assessments and reviews. Reusing a key with different content returns a conflict; an edited post receives a new content version.

## High-level design

A cheap screening stage handles clear cases and sends uncertain content to a multimodal scorer. The policy router commits the decision and publishes it to consumers such as feeds and search.

```mermaid
flowchart TB
    P["Post service"] --> API["Moderation API"]
    API --> SCREEN["Fast screening"]
    SCREEN -->|"Uncertain"| MODEL["Multimodal scorer"]
    SCREEN -->|"Clear result"| POLICY["Policy router"]
    MODEL --> POLICY
    POLICY --> D[("Decision store")]
    POLICY --> REVIEW["Human review queue"]
    D --> EVENTS["Enforcement events"]
```

[Meta's generalized moderation approach](https://ai.meta.com/blog/the-shift-to-generalized-ai-to-better-identify-violating-content/) motivates sharing representations across related categories. This proposal retains independent category thresholds and policies.

## Storage

- **Post/media storage:** immutable content versions in the existing catalog and restricted object storage. The moderation service stores references rather than duplicate media.
- **PostgreSQL:** assessments, policy decisions and review provenance. Use transactions and a per-post decision version so an older assessment cannot overwrite a newer enforcement result.
- **Redis:** cached content embeddings and recent behavioral aggregates, keyed by content/model version with explicit freshness.
- **Kafka:** assessment triggers, reports and enforcement events. A transactional outbox publishes committed decisions; consumers deduplicate by decision version.
- **Parquet/object storage:** immutable, access-controlled training snapshots and model artifacts. Keep label availability separate from content creation time.

Decision history remains auditable within approved retention. Raw evidence and harmful media require narrower access than aggregate model metrics.

## From request to response

### Evaluating a new post

1. Validate modality and size limits, authorize the caller and resolve the immutable content version.
2. Run approved known-content matching and a lightweight content model. Perceptual hashes provide similarity signals; their thresholds and policies are validated independently.
3. Route uncertain or high-risk cases to the heavier model. Encode text/OCR and image/video representations, then combine them with category heads.
4. Apply a versioned calibration mapping and policy thresholds. Missing features, unsupported languages or incomplete video analysis can require review or quarantine.
5. Commit the assessment and decision with an outbox event. Return the committed decision version.
6. Feed/search consumers apply the enforcement event and invalidate affected caches. Track propagation lag so an older cached eligibility value is detectable.

Encoding every modality for every post is expensive. The cascade reduces heavy inference, but its early-exit recall needs separate evaluation.

### Re-evaluating a post

Deduplicated reports update exposure-normalized behavioral aggregates. A trigger queues re-evaluation against the current content version. Reuse cached content encodings only when content and model versions match; recompute the lightweight behavior head, then commit only if the new decision is based on current evidence.

### Handling an outage

Use the last approved screening/model bundle and a bounded queue. If the service cannot complete required checks, follow the category's quarantine/review policy. Preserve retryable work and report backlog age; changing a screening threshold during overload also changes safety coverage and requires policy approval.

## Deep dives

### Which model captures multimodal meaning?

Text and images can be benign separately while conveying a violation together.

- **Single-modality models:** efficient and easy to inspect, but miss some combined meanings.
- **Late fusion:** concatenate independently encoded features; simpler serving, with learned cross-modal interactions.
- **Joint attention — recommended for difficult cases:** allow text and image tokens to interact, while retaining a cheaper screening model for clear cases.

Use a multilingual text encoder, an image encoder and category-specific heads. [FLAVA](https://arxiv.org/abs/2112.04482) is a reference for language/vision representations; the final architecture is selected through category-specific evaluation.

Keep content encodings separate from rapidly changing report/count features. Re-evaluation can reuse expensive content work when versions match. Compare the screening recall, heavy-model quality and complete cascade quality; a missed early exit limits overall recall.

**The multimodal cascade in one assessment**

Pin the post's content version, extract text/OCR and image features, and run the inexpensive screen. Clear lower-risk exits are allowed only under independently validated thresholds. Ambiguous cases go to the heavy fusion model, which compares text and visual representations before producing separate category scores.

```mermaid
flowchart TB
    C["Pinned content version"] --> S["Text, OCR and image encoders"]
    S --> F["Cheap screening heads"]
    F -->|ambiguous| H["Joint multimodal model"]
    F -->|validated exit| P["Versioned policy"]
    H --> P
    P --> D["Commit assessment and decision"]
    D --> E["Enforcement outbox"]
```

For example, benign text over an otherwise benign image may become a prohibited message when read together. The joint model receives both representations; independent binary decisions would miss that relationship.

Cache embeddings by content and encoder version. A new report changes behavioral context without requiring the image to be re-encoded. An edit changes content identity and invalidates the old assessment. Quality tests include the whole cascade, because a heavy model never sees content mistakenly dismissed by the screen.

### How should rare violations be learned and evaluated?

Natural traffic contains many legitimate posts. Balanced training batches help the model see rare categories, but also change the apparent class prevalence.

- **Natural sampling:** represents production frequency, with fewer rare examples per batch.
- **Class weighting or oversampling:** emphasizes rare violations, with overfitting and calibration risks.
- **Targeted sampling plus natural-prevalence evaluation — recommended:** combine reviewed positives, hard legitimate examples and representative audits; record sampling probabilities.

[Focal loss](https://arxiv.org/abs/1708.02002) downweights well-classified examples. Evaluate it alongside weighted cross-entropy rather than assuming ordinary cross-entropy always learns a trivial classifier.

Reports are weak evidence and can be coordinated. Human labels include category, policy version, reviewer agreement and provenance. Time-based splits use only features available at assessment time; group near-duplicate content to prevent leakage.

Report PR-AUC, recall at the chosen precision, false-positive rate and harmful-view prevalence. Evaluate languages and categories separately; successful appeals describe the subset that appealed, rather than all mistaken removals.

**Build datasets with different purposes**

Maintain reviewed positive examples, hard legitimate examples and a representative audit sample as distinct sources. Training can oversample rare categories; prevalence and precision estimates use representative held-out data with selection information retained.

A coordinated-report campaign may create many reports for legitimate material. Store reports as features/weak evidence rather than turning their count directly into a gold label. Review records include policy version and disagreement; policy changes can require relabeling before reuse.

```text
Targeted reviews → hard examples for training
Representative audits → prevalence and quality estimates
Appeals → evidence about the subset that appealed
```

Near-duplicate memes or copied posts must be grouped before time-based splitting; otherwise the same visual template leaks across train and test. Evaluate language/category cohorts with enough reviewed support and uncertainty intervals. A high aggregate precision can conceal poor performance in a rare category, while balanced training prevalence cannot be reported as live prevalence.

### How do thresholds produce reliable actions?

A calibrated probability estimates risk on a particular distribution. It does not itself guarantee 95% removal precision after traffic changes.

- **One global threshold:** simple, but hides category and language differences.
- **Automatically changing thresholds from recent reviews:** responsive, but vulnerable to small samples and reviewer-selection bias.
- **Versioned category thresholds — recommended:** fit calibration on independent mature labels, then choose action thresholds with sample-size and uncertainty checks.

```python
if required_checks_incomplete:
    action = policy.incomplete_check_action
elif score >= policy.removal_threshold:
    action = "remove"
elif score >= policy.review_threshold:
    action = "quarantine"
else:
    action = policy.lower_risk_action
```

Track review capacity as part of threshold selection. A wider review band improves coverage only if reviewers can handle it within the intended delay. Separate score-model releases from policy changes, with rollback for both.

**Scores become actions through a separate policy**

An assessment writes content version, category scores, calibration version and required-check completeness. The policy maps those values to allow, quarantine/review or remove, with thresholds selected using independently reviewed data and available review capacity.

If 10K posts/day enter the review band but reviewers can handle 2K, the queue violates its turnaround target. Adjust admission, thresholds or staffing through an explicit policy decision; a review state without capacity only postpones action.

```text
Score 0.2, checks complete → lower-risk action under category policy
Score 0.7                → review band
Score 0.98               → removal only if its validated threshold is met
Checks incomplete        → explicit incomplete-check policy
```

These numbers illustrate control flow, not universal thresholds. Persist decisions transactionally with their enforcement outbox. Consumers apply only a newer decision version to the same content version. An old slow assessment arriving after a content edit or human correction must not restore an obsolete action. Review results create auditable revisions, and rollback changes future policy while retaining previous decisions.

### How do we learn after enforcement suppresses feedback?

Removed posts accumulate fewer views and reports. Training only on surviving content therefore changes which examples and behaviors are observed.

- **Train on survivors:** convenient, but systematically excludes enforced content.
- **Impute missing behavior:** can support analysis, with uncertain counterfactual assumptions.
- **Independent pre-enforcement and post-decision review — recommended:** sample across decisions, label quarantined/removed material in restricted review systems and log selection probabilities.

Evaluation sampling preserves normal safety enforcement. It does not require intentionally exposing users to known harmful content. Record which observations were truncated by enforcement and distinguish missing behavior from zero reports.

Use representative audits to estimate missed violations and targeted reviews to learn difficult boundaries. Keep both datasets identifiable so targeted review does not masquerade as prevalence measurement.

**Measure missed violations without weakening enforcement**

Select audit samples from the pre-decision population and from each action band using logged selection probabilities. Review retained evidence in restricted systems. This provides observations about allowed, quarantined and removed content while normal user-facing safeguards remain active.

Suppose reports fall to zero after a removal. That is censored exposure, not a clean negative label. Store the decision time and the period during which users could view the material. Models using report velocity receive the history available at assessment time, rather than the later suppressed count.

Representative audits estimate current missed violations and mistaken actions; targeted disagreement review supplies difficult training examples. Keep these datasets separate so a deliberately enriched violation sample does not become a prevalence claim. Weighting helps only where sampling support exists. Appeals contribute verified evidence for their reviewed cases but cannot alone describe all removed posts.

### How do emerging patterns and releases stay controlled?

New formats and language patterns can reduce recall before enough labels arrive.

- **Fixed retraining calendar:** predictable, but slow for abrupt shifts.
- **Continuous model/threshold changes:** responsive, with noisy labels and complex recovery.
- **Scheduled training plus reviewed drift response — recommended:** monitor slices continuously, gather new labels and release through explicit evaluation gates.

Input drift suggests investigation; mature labeled performance establishes quality degradation. New policy descriptions or few-shot models can prioritize review while gold labels accumulate. They need category-specific validation before automated enforcement.

Block incompatible schemas and malformed datasets. Shadow evaluation measures latency and decision differences while existing enforcement stays active; controlled rollout measures quality and propagation. Rollback restores the compatible model/policy bundle and leaves the decision audit trail intact.

**Release and drift investigation**

Compare input drift with missing-feature, category-score, enforcement and mature audit trends. A spike in removals may follow a new format, a tokenizer error or a policy change; route diagnosis to the affected stage.

Warm a complete content-encoder/fusion/calibration/policy bundle and test fixtures covering category/language interactions. Shadow against the existing decision path, review sampled disagreements, then canary only after quality gates pass. Preserve current enforcement during evaluation.

A rollout failure restores the prior compatible bundle and leaves the audit trail intact. Outbox consumers continue applying versioned human decisions and removals. Measure propagation from decision commit to feed/search/media enforcement, plus review age and model fallback rate. A model with good offline accuracy still fails the product goal if its decisions arrive after broad exposure.
