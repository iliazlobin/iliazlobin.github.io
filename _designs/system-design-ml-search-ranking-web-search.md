---
layout: post
title: "ML: Search Ranking / Web Search"
category: system-design-ml
redirect_from:
  - /designs/ml-system-design-search-ranking-web-search/
date: 2026-07-08
tags: [Machine-Learning, Search-Ranking, Ranking, Retrieval, Web-Search]
thumbnail: /images/posts/system-design-ml-search-ranking-web-search.svg
last_modified_at: 2026-10-12
description: "Design of a web search service that retrieves relevant pages and ranks the results for a user's query."
notion_source: https://app.notion.com/p/397d865005a8811d94baea413e149054
---

Design of a web search service that retrieves relevant pages and ranks the results for a user's query.

<!--more-->

## Problem

A user enters a query to find a page, answer a question or research a topic. The search service retrieves matching documents and returns a ranked list with titles, URLs and snippets.

The index contains far more documents than a request can score individually. Retrieval must preserve useful results while narrowing the candidate set; ranking then spends more computation on the strongest matches. New pages and updated documents also need to become searchable promptly.

## Requirements

### Functional requirements

- **Search the web:** return relevant pages for a text query, with pagination and snippets.

- **Recognize query intent:** handle exact-site queries, factual questions and broader topic searches.

- **Use relevant context:** apply language and permitted location preferences; support an unpersonalized mode.

- **Refresh results:** incorporate newly crawled pages, edits and removals.

Spelling correction, query suggestions, image/video search and advertising are separate services.

### Non-functional requirements

- **Scale:** assume 100B indexed pages and a peak of 40K search requests/s.

- **Latency:** target p99 below 500ms for a results page.

- **Availability:** target 99.9%, with lexical results available during neural-ranking failures.

- **Freshness:** make an accepted crawl update searchable within five minutes. Coverage depends on crawl scheduling.

- **Quality:** improve judged NDCG@10 and retrieval recall while preserving navigation-query success and language coverage.

- **Privacy:** separate public query caching from user-specific results; restrict and expire identifiable search logs.

## Back-of-the-envelope calculations

- Assume 500M queries/day: `500M / 86,400 ≈ 5.8K requests/s` on average; 40K/s is roughly a sevenfold peak.

- Ten displayed results per query produce up to 5B result impressions/day.

- A 128-dimensional float32 vector requires 512 bytes; 100B document vectors require about 51TB before replicas and index overhead.

- Proposed candidate budgets: roughly 10K retrieved documents → 500 cheaply ranked → 50 neural-ranked → ten returned. Measure recall and latency at each boundary.

## Core entities

- **Document:** a crawl-derived page version, including its URL, text, language and eligibility.

- **Query:** the user's text and permitted request context.

- **Search impression:** the result IDs and positions actually displayed under a particular serving bundle.

- **Serving bundle:** compatible retrieval encoders, index generations, feature definitions and ranking models.

```protobuf
message Document {
  string document_id;
  string canonical_url;
  string title;
  string text_ref; // Object-storage reference
  string language;
  Timestamp crawled_at;
  string content_version; // Identifies the content used by indexes/models.
  int64 crawl_revision; // Orders accepted changes; unchanged on replay.
  bool removed; // Deletion marker committed with the revision.
}

message SearchImpression {
  string request_id;
  string query_ref; // Restricted log, with retention limits
  repeated string document_ids; // Display order
  string bundle_version;
  Timestamp served_at;
}

message ServingBundle {
  string bundle_version;
  string lexical_index_version;
  string dense_index_version;
  string encoder_version;
  string ranker_version;
}

```

Document updates replace an indexed version; deletions retain a tombstone until every serving replica has applied it.

## API

```yaml
GET /v1/search:
  query:
    q: "postgres unique constraint"
    language: en
    cursor: opaque continuation
  response:
    request_id: search-123
    results:
      - document_id: doc-7
        title: "Constraints"
        url: "https://www.postgresql.org/docs/current/ddl-constraints.html"
        snippet: "A unique constraint..."
    next_cursor: opaque continuation
    degraded: false

POST /v1/search-events:
  body:
    event_id: event-123
    request_id: search-123
    document_id: doc-7
    action: click

```

The cursor includes the query/context hash and index generation. A materially changed query starts a new search; feedback ingestion deduplicates retries by `event_id`.

## High-level design

The query service searches lexical and vector indexes in parallel, merges their candidates and applies progressively richer ranking. Crawling and training publish new data and model versions separately.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
    U["User"] --> Q["Query service"]
    Q --> L["Lexical<br>retrieval"]
    Q --> V["Dense<br>retrieval"]
    L --> M["Merge and<br>deduplicate"]
    V --> M
    M --> R["Light then<br>neural ranking"]
    R --> O["Results and<br>snippets"]
    F[("Features /<br>metadata")] --> R
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
class U,Q,L,V,M,R,O request;
class F data;

```
## Storage

- **Lucene-based lexical index:** store token posting lists and document fields for BM25 retrieval. Partition documents across shards and merge each shard's top results.

- **ANN vector index:** use sharded ScaNN or HNSW for dense retrieval. The query encoder and indexed document embeddings belong to the same bundle; publish a compatible snapshot before switching traffic.

- **Partitioned document metadata — [Cassandra](/designs/tech-apache-cassandra/):** key current page metadata by `document_id` across replicated partitions. The 100B-page estate needs distributed point reads rather than cross-document transactions. Conditional updates—Cassandra's [lightweight transactions](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html#update)—accept only a higher `crawl_revision` and commit its content version and deletion marker together. Their coordination cost and quorum availability must be measured against crawl throughput and the five-minute freshness target. Keep crawled text and immutable training snapshots in object storage.

- **[Redis](/designs/tech-redis/):** cache public query results and recent feature aggregates. Keys include language, index generation and ranking policy; personalized results need separate keys and access controls.

- **[Kafka](/designs/tech-kafka/) and Parquet:** retain crawl changes and displayed-result events for replay and training. Registry metadata and rollout state fit a transactional [PostgreSQL](/designs/tech-postgresql/) database.

The index is derived from versioned crawl records. Replay rebuilds a lost shard; tombstones prevent removed pages from reappearing during recovery.

## Functional scenarios

### Retrieving and ranking search results

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
sequenceDiagram
  participant U as Application
  participant A as Search API
  participant R as Candidate retrieval
  participant M as Ranking and eligibility
  participant E as Event stream
  rect rgb(232, 240, 254)
    U->>A: Query, language and context
    A->>R: Retrieve and merge bounded candidates
    R-->>A: Candidate IDs and retrieval features
    A->>M: Light shortlist, deep scores and policy checks
    M-->>A: Eligible results and matching-version snippets
    A-->>U: IDs, request ID and bundle version
  end
  rect rgb(230, 244, 234)
    U-->>E: Actual impressions and later outcomes
  end

```

Retrieval determines which items can compete, and staged ranking spends expensive inference only on a bounded shortlist. The application reports actual display separately from the server response, so training outcomes join to the same request and item IDs. Eligibility checks remain active on fallback paths.

1. Validate query length and context, assign a request ID and pin a serving bundle. Normalize text using that bundle's tokenizer and language rules.

2. Search the lexical index for exact terms and the vector index for semantic matches. Merge by document ID using reciprocal-rank fusion, which combines ranks without assuming the two score scales are comparable.

3. Load features in batches: text-match scores, document quality, language match, crawl age and permitted context. A cheap LambdaMART ranker reduces the candidate set.

4. Apply a cross-encoder to the remaining shortlist. It reads query and document text together, so this stage is more expensive than a precomputed vector lookup.

5. Apply eligibility, duplicate-page and diversity rules, generate snippets from the matching document version, then return the first page.

6. Record displayed IDs, positions and versions. Associate later clicks and reformulations with the request; logging has bounded buffering and explicit loss metrics.

Each shard and ranking stage has a deadline. A slow dense shard yields lexical candidates; a slow cross-encoder uses the light-ranker order. Repeatedly increasing candidate counts increases recall but also raises feature-read and inference cost.

### Applying a crawl update

The ingestion worker validates the document, records its new version and publishes an indexing event. Accepted changes carry increasing per-document `crawl_revision` values; retries and replay retain the original value. Lexical and dense consumers apply only newer revisions and report watermarks. A deletion produces an eligibility tombstone before replicas remove the physical index entries. Freshness monitoring measures the time from accepted crawl event to searchable version.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
sequenceDiagram
    participant C as Crawler
    participant D as Document store
    participant I as Index builders
    participant Q as Search service
    rect rgb(230, 244, 234)
        C->>D: Commit document version or removal
        D-->>I: Versioned change
        I->>I: Update lexical and compatible dense indexes
        I->>D: Record applied watermarks
    end
    rect rgb(232, 240, 254)
        Q->>I: Retrieve candidate document versions
        I-->>Q: Bounded candidate IDs
        Q->>D: Hydrate and check current eligibility
        D-->>Q: Current eligible content
        Q->>Q: Rank and assemble results
    end
```

Indexing follows the accepted document change, while serving checks current removal and access state before returning content. A model-space release publishes a compatible encoder/index bundle separately; replaying a crawl event must not introduce a vector from an incompatible generation.

## Deep dives

### Hybrid lexical and semantic retrieval {#how-should-lexical-and-semantic-retrieval-work-together}

**Problem.** Exact matching is important for product names, identifiers and navigation queries. Semantic retrieval helps when the user and document express the same idea with different words.

**Options.**

- **Lexical retrieval only:** Use exact terms and term statistics in an inverted index. Identifiers and navigation queries work well, but documents using different vocabulary can be missed.

- **Dense retrieval only:** Find nearby precomputed document vectors for the query representation. Semantic paraphrases are covered, but rare names and exact identifiers can be poorly preserved by the encoder.

- **Hybrid retrieval — recommended:** Retrieve both sets, deduplicate document IDs and fuse ranks before detailed scoring. Coverage is broader; two index families add fan-out, freshness coordination and candidate-budget tuning.

Use hybrid retrieval with bounded rank fusion. Web queries include both exact entities and vocabulary mismatch. We accept dual-index cost and bounded fan-out so one retrieval representation does not determine all coverage; downstream ranking measures the merged candidates.

[DPR](https://arxiv.org/abs/2004.04906) demonstrates separately encoded query and passage retrieval. For this design, train the query/document encoders on relevant pairs with in-batch and mined negatives; keep unknown relevance separate from judged irrelevance. Sampling correction matters when popular documents dominate the batches.

Measure candidate recall using held-out judgments before tuning the final ranker. A relevant page excluded at retrieval cannot be recovered by later ranking. Shard timeouts and language-specific recall are separate evaluation slices.

**Merge two retrieval paths without mixing incomparable scores**

Run lexical and dense retrieval in parallel with a shared deadline. Lexical search matches token postings and rare identifiers; dense retrieval embeds the query and finds nearby document vectors in the compatible index. Deduplicate document/version IDs before scoring.

BM25 values and vector similarities have different scales. Use a validated fusion method such as reciprocal rank fusion for the first merged shortlist, or learn source-specific calibrated features in the light ranker. Raw addition is not a meaningful default.

```python
# Illustrative reciprocal rank fusion over source ranks.
score[doc] = sum(1 / (constant + rank)
                 for rank in ranks_from_available_sources(doc))

```

A navigation query like a product serial number may rely primarily on exact terms, while a paraphrased question benefits from dense candidates. Evaluate those intents independently. Track retrieval recall against judged relevant pages and record when one source times out; an apparently successful result can still have degraded recall.

**Tradeoffs and recovery.** Current removal/access filters apply before return even if an older index still retrieves the document. Versioned IDs prevent deduplication from selecting an obsolete passage.

### Bounded ranking cascades {#where-should-expensive-ranking-happen}

**Problem.** A cross-encoder evaluates query/document interactions directly, but doing that for every retrieved candidate makes inference dominate latency.

**Options.**

- **Feature ranker throughout:** Score with prepared match, quality and context features. Serving is inexpensive and inspectable, but fine query–passage interactions may be missed.

- **Cross-encoder over all candidates:** Read query and document text together for every retrieved item. Matching is richer, but inference and text fetching grow with the entire candidate set and can dominate p99.

- **Bounded ranking cascade — recommended:** Use LambdaMART or a distilled student to shortlist, then cross-encode a final batch. Deep scoring fits a deadline; useful documents pruned earlier are irrecoverable and need stage-retention evaluation.

Shortlist with a light ranker, then cross-encode the bounded final set. The search deadline leaves limited capacity for joint text inference. We accept measured shortlist loss in exchange for bounded work, tuning candidate budgets with relevance and tail latency rather than average throughput alone.

The [LambdaMART overview](https://www.microsoft.com/en-us/research/publication/from-ranknet-to-lambdarank-to-lambdamart-an-overview/) explains ranking losses for tree-based models; [BERT passage re-ranking](https://arxiv.org/abs/1901.04085) provides the query/text interaction model.

Train a student on teacher scores or ordering while also retaining judged labels. Compare teacher/student agreement, NDCG and end-to-end latency on the actual candidate distribution. Hardware counts and batch sizes come from load tests; batch waiting, shard fan-out and queue saturation contribute to p99.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart LR
    A["Hybrid<br>candidates"] --> B["Cheap<br>shortlist"]
    B --> C["Bounded neural<br>batch"]
    C --> D["Final results"]
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
class A,B,C,D request;

```

On inference timeout, reuse the shortlist's existing order. A fallback request still applies document eligibility and removal rules.

**What the cross-encoder adds**

A two-tower score compares independently encoded vectors. A cross-encoder processes the query and candidate text together, allowing token-level interactions such as negation or an exact entity mentioned in the right context. This richer operation runs only on the final bounded shortlist.

```text
Query + document features → light ranker → bounded shortlist
Query paired with each shortlisted passage → cross-encoder → final order

```

Select passages with the same versioned text pipeline used in training. Truncation needs a policy: blindly taking the first tokens can omit the matching answer deep in the page. Cache document preprocessing, batch pairs by length and cap queue wait.

**Tradeoffs and recovery.** Distill teacher scores for cheaper shortlist ranking, while retaining judged labels to avoid copying every teacher error. Plot final relevance versus neural candidate count on the actual hybrid-retrieval distribution. When inference exceeds its budget, the saved light-stage order becomes the fallback; annotate that mode for measurement and still hydrate current document eligibility.

### Exposure-aware training labels {#how-do-clicks-become-useful-training-labels}

**Problem.** A click reflects relevance, display position, snippet quality and user behavior. Some queries are answered directly by a snippet, so a successful search may have no click.

**Options.**

- **Raw clicks:** Treat clicked documents as useful. Labels are abundant, but position, snippet quality and the previous exposure policy determine what can be clicked.

- **Judged relevance only:** Review query/document usefulness directly. Evaluation has a stable semantic anchor; reviewer cost and query coverage limit training scale, and useful no-click answers need explicit criteria.

- **Judgments plus exposure-aware interactions — recommended:** Use human judgments for evaluation and impression-linked outcomes for learning. Scale and semantic evidence complement each other; selection bias, delayed actions and annotation consistency require separate controls.

Combine judged relevance with exposure-aware interactions. A successful search can end with a snippet rather than a click. We accept reviewed relevance cost and richer event joins so the design can improve usefulness without optimizing only attractive result positions.

Record displayed positions, UI version and known exploration probabilities. Inverse-propensity weighting uses estimated examination/exposure probabilities, with clipping to control variance; the observed click rate at a position mixes exposure and relevance. Small randomized experiments help estimate these effects.

Join labels only after their observation window closes. Use request-time feature values and document versions, with time-based train/validation/test splits. Inspect ranking quality by query intent, language, document age and query frequency. Protect the final test set from model selection.

**Build a click-training example correctly**

The exposure record contains query, displayed document versions, positions, snippets, UI version and exploration policy. Join later clicks/dwell or successful reformulation to that exact request. A retrieved document that never appeared is not a displayed negative.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryTextColor":"#202124","primaryBorderColor":"#9aa0a6","lineColor":"#5f6368","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteTextColor":"#202124","noteBorderColor":"#9aa0a6","signalColor":"#5f6368","signalTextColor":"#202124","labelBoxBkgColor":"#fef7e0","labelBoxBorderColor":"#9aa0a6"}}}%%
flowchart TB
    A["200 retrieved<br>documents"] --> B["10 displayed<br>documents"]
    B --> C["User examines<br>a subset<br>Partly<br>unobserved"]
    C --> D["Click or<br>no-click<br>success"]
    B -.-> E["Exposure log"]
    D -.-> F["Outcome log"]
    E --> G["Join evidence<br>by request"]
    F --> G
    class A,B,C,D request;
    class E,F data;
    class G control;
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
classDef danger fill:#fce8e6,stroke:#9aa0a6,color:#202124;
```

Use judged query/document pairs as the stable evaluation anchor. A no-click can mean failure, abandonment or a useful answer in the snippet; the label policy distinguishes these where evidence supports it.

**Tradeoffs and recovery.** Randomized position exposure helps estimate examination effects, but rare-query support and high-variance inverse weights still require limits. Keep snippets and document versions in historical examples so today's improved snippet is not accidentally used to explain yesterday's click. Group sessions in chronological splits and leave the final test set out of candidate selection.

### Index freshness and compatible model updates {#how-do-freshness-and-model-updates-stay-reliable}

**Problem.** A new page needs a searchable representation before its eventual popularity is known. A new encoder also changes the meaning of every vector in its index.

**Options.**

- **Full rebuild for every update:** Publish one consistent snapshot after each crawl change. Recovery is straightforward, but repeatedly rebuilding a large corpus cannot meet the five-minute freshness target efficiently.

- **Incremental updates only:** Apply every document change to live indexes. Freshness is fast, but tombstones and fragmentation accumulate and encoder changes can mix vector spaces.

- **Incremental ingestion with periodic base rebuilds — recommended:** Query an immutable base plus versioned deltas, merging the newest document version. Freshness and compaction have separate clocks; watermarks, deletion filters and compatible encoder cutovers add operational work.

Incrementally update versioned document indexes and publish compatible model/index bundles. Crawl changes are smaller and more frequent than model-space releases. We accept layered-index coordination and periodic rebuild cost to preserve fresh documents and reproducible rollback without serving incompatible vectors.

Use crawl age and query intent as ranking features. Time-sensitive queries can favor recent pages; reference queries often benefit from established sources. If a freshness adjustment is used, its half-life is query-dependent:

```python
freshness_weight = 2 ** (-age_hours / half_life_hours)

```

Validate a model/index bundle offline, shadow it on live queries, then run a controlled experiment. Track relevance, freshness, latency and fallback rate together. Rollback switches the compatible bundle as a unit while ingestion continues; malformed feature data blocks release and leaves the last healthy bundle serving.

**An index update and a model update have different clocks**

Crawling writes a versioned document event. The delta lexical index and the active encoder's vector overlay consume it, then publish searchable watermarks. The serving merger chooses the latest eligible version from base and delta layers.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
    E["Versioned<br>crawl event"] --> L["Lexical delta<br>index"]
    E --> V["Active-encoder<br>vector overlay"]
    L --> M["Latest-version<br>merge"]
    V --> M
    B["Immutable base<br>snapshots"] --> M
    M --> F["Current<br>removal filter"]
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
class M request;
class E,L,V,B data;
class F control;

```

A tombstone wins over older base content and survives replay through the retention window. Compaction atomically publishes the new base generation before retiring inputs.

**Tradeoffs and recovery.** For an encoder release, build vectors using that encoder and warm its query tower before cutover. New-document updates during the build need a matching overlay after the snapshot watermark. Rollback restores both retrieval components, not just the ranking weights. Report freshness from observed publish watermarks and measure deleted-document propagation separately.
