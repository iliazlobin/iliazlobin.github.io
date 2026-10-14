---
layout: post
title: "SD: Bitly / URL Shortener"
category: system-design
date: 2026-07-23
tags: [System Design, URL Shortener]
thumbnail: /images/posts/system-design-bitly-url-shortener.svg
last_modified_at: 2026-10-12
description: "This document describes the design of a Bitly-style URL-shortening service."
notion_source: https://app.notion.com/p/3a6d865005a881f9baf3e69e01195f14
---

This document describes the design of a Bitly-style URL-shortening service. A user submits a long URL, and the service generates a unique short code or accepts a custom alias, stores the corresponding destination URL, and returns a short link. When a user follows that link, the service redirects the browser to the destination and records the click for analytics.

<!--more-->

## Problem

Long URLs can be cumbersome to share in messages, emails and social posts. Users need a compact, shareable link, and businesses use click analytics to measure campaign performance.

Users follow existing short links much more often than they create them, making this a read-heavy workload.

The service needs to redirect users with low latency and record clicks for analytics. Processing click events asynchronously keeps analytics writes off the redirect request path.

## Requirements

### Functional requirements

- **Create a short link.** A user submits a long URL and receives a unique short link that maps to it.
- **Follow a short link.** The service redirects users who follow an unexpired, permitted public short link to its destination URL.
- **View click analytics.** An organization owns the links created by its users. A user selects one of these links and a date range to see click counts, geographic breakdowns and referring sites.
- **List and preview links.** A user can browse their organization's links and preview a destination URL without following the link or adding a click.
- **Choose a custom alias.** A user can choose a code such as `spring-sale`, provided it is available on the chosen domain.
- **Set an expiration time.** A user can set an expiration time, after which the short link returns an expired-link response.
- **Handle unsafe destinations.** Users see a warning for suspicious destinations or a block page for prohibited destinations.

### Non-functional requirements (targets)

- **Scalability:** support 40B active links, 60K redirects/s and 580 creates/s at peak.
- **Latency:** return redirect responses in under 10ms at P50 and 50ms at P99.
- **High availability:** target 99.99% availability for the redirect endpoint, including during allocator or analytics outages.
- **Link consistency:** each `(domain, short_code)` identifies one link, and newly created links are usable immediately.
- **Analytics freshness:** include 98% of durably collected click events in reported totals within 90 seconds, with the latest processed time shown.
- **Cache freshness:** invalidate service records after destination or safety changes; private redirect freshness ends by both record validation and link expiration.
- **Access control:** authenticated organization users can create links and read their organization's analytics; public redirects are unauthenticated.

### Out of scope

- Authentication implementation and billing.
- Link-in-bio pages, QR codes and mobile deep links.

## Back-of-the-envelope calculations

- **Traffic:** assume 30B redirects and 300M new links/month—a 100:1 read/write ratio. A 5× burst gives ≈58K redirects/s and 580 creates/s.
- **Code capacity:** seven [base62](https://en.wikipedia.org/wiki/Base62) characters—letters and digits—provide `62^7 ≈ 3.5T` codes. 40B active links use ≈1.1%; retired codes and unused allocated IDs also consume capacity.
- **Click storage:** `30B × 200 bytes ≈ 6TB/month` raw. Assuming 10–100× aggregation, retain ≈60–600GB/month before storage overhead.
- **Database reads:** in an illustrative 95% cache-hit scenario, `58K × 5% ≈ 2.9K reads/s` reach storage. The hit rate depends on traffic and cache policy.
- **Link storage:** an assumed 512 bytes per Link gives `40B × 512 ≈ 20.5TB` before indexes, retired-key reservations and replication. Partition sizing must measure the actual row and index footprint.

## Core entities

Each Link record is identified by `(domain, short_code)`. This pair is its logical primary key: `bit.ly/spring-sale` and `go.example.com/spring-sale` are separate links, while each code on a given domain belongs to one link.

The [Protobuf-style](https://protobuf.dev/programming-guides/proto3/) models below show the core fields and relationships.

```protobuf
message Link {
  // Primary key: (domain, short_code).
  string domain;
  string short_code;
  string long_url;           // Destination URL.
  string org_id;             // Owner -> Organization.
  Timestamp created_at;      // Organization listing order.
  int64 version;             // Advances on destination, expiry or verdict changes.
  Timestamp expires_at;      // Unset for links without an expiry.
  string safety_status;      // safe | warn | blocked; new links start warn.
  Timestamp last_scanned_at; // Unset until a scan completes.
}

message Organization {
  string org_id;
  string name;
}
```

`Organization` identifies the group of users that owns a link. The service checks the authenticated user's membership before allowing them to manage the link or read its analytics.

```protobuf
message ClickEvent {
  string event_id;           // Unchanged when delivery is retried.
  string domain;
  string link_short_code;    // With domain, identifies the Link.
  Timestamp timestamp;       // Time the user followed the link.
  string ip;                 // Derives country; retention is restricted.
  string referrer;
}

message ClickRollup {
  // One count per link, UTC hour, country and referring site.
  string domain;
  string link_short_code;
  Timestamp bucket;
  string country;
  string referrer_domain;
  uint64 click_count;
}
```

```protobuf
message IDSequence {
  string sequence_id;        // Shared sequence for generated codes.
  uint64 next_id;            // Advance atomically to reserve an ID range.
}
```

## API

Proposed service API:

```yaml
"POST /v4/shorten":
  access: authenticated organization member
  body:
    long_url: string
    domain: optional string
    alias: optional string
    expires_at: optional UTC timestamp
  result: [domain, short_code, link]
  errors: {400: invalid input, 409: alias taken, 429: creation limit}

"GET /{short_code}":
  access: public
  domain: request hostname
  result: {status: 301, Location: long_url}
  condition: allowed and unexpired
  errors: {404: missing, 410: expired, 403: blocked}
  warning: show a warning before navigation

"GET /v4/bitlinks/{short_code}/clicks":
  access: organization owns the link
  query:
    domain: string
    units: "hour | day"
    from: UTC bucket boundary
    to: UTC bucket boundary
  interval: "[from, to)"
  result: [time buckets, click counts, country/referrer breakdowns,
           latest processed time]
  empty_result: zero collected clicks
  query_failure: unavailable analytics

"POST /v4/expand":
  access: authenticated organization member
  body: {domain: string, short_code: string}
  result: long_url
  redirect: false
  record_click: false

"GET /v4/organizations/{org_id}/links":
  access: organization member
  query: {size: integer, page: integer}
  result: paginated links owned by the organization
```

Allowed links return HTTP 301 with an expiration-bounded private cache lifetime. Warning and block pages use `no-store`. The redirect-cache deep dive explains the freshness and analytics limits.

## High-level design

Authenticated requests use the API gateway for link creation and analytics. Public links use a separate redirect service, which reads URL mappings from a local cache or the link database. An edge gateway forwards public requests; shared caching is disabled for redirects.

The creation service generates short codes from allocated ID ranges and saves the mappings. A safety worker scans destinations, while an asynchronous click pipeline aggregates events into hourly counts. Services scale independently across availability zones, with replicated link storage.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
flowchart TB
    User["User"] --> Web["Web client"]
    subgraph Entry["Entry points"]
        CDN["Edge gateway<br>Public links"]
        API["API gateway<br>User access<br>and rate<br>limits"]
    end
    subgraph Services["Application services"]
        Shorten["Link creation<br>service"]
        Redirect["Redirect<br>service<br>Record cache"]
        Safety["Safety worker"]
        Clicks["Click pipeline<br>Queue and<br>aggregation"]
    end
    subgraph Data["Storage"]
        Links[("Link database")]
        Allocator[("ID-range<br>allocator")]
        Rollups[("Analytics<br>store")]
    end
    Web -->|Open link| CDN
    Web -->|Create link or read analytics| API
    CDN -->|Forward request| Redirect
    API -->|Create| Shorten
    API -->|Read totals| Rollups
    Shorten -->|Get ID range| Allocator
    Shorten -->|Save mapping| Links
    Shorten -.->|Request scan| Safety
    Redirect -->|Record-cache miss| Links
    Redirect -.->|Record click| Clicks
    Clicks -->|Write totals| Rollups
    Safety -->|Update verdict| Links
  classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef background fill:#e6f4ea,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124,stroke-width:1px
  class User,Web,CDN,API,Shorten request
  class Redirect,Safety,Clicks,Links,Rollups background
  class Allocator control
  style Entry fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
  style Services fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
  style Data fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
```

Safety changes invalidate cached Link records. Click collection covers requests handled by the redirect service; browser reuse can bypass that path.

## Storage

Link creation needs durable, unique records and immediate reads; reporting needs scans over time and dimensions. Use a relational authority for mappings and allocation, local memory for cached records, a durable event log for clicks and a column-oriented analytics store.

| Data | Required properties | Selected storage |
| --- | --- | --- |
| Link records | Fast reads by domain and code, durable writes, atomic creation, immediate visibility, horizontal partitioning. | Hash-sharded PostgreSQL |
| Organizations and ID ranges | Relational ownership data and transactional range allocation. | PostgreSQL |
| Cached link records | Low-latency reads, bounded memory, expiration and invalidation. | Per-instance LRU cache |
| Click events and hourly totals | Batched ingestion, time-range queries, grouped reports, compression and retention controls. | ClickHouse |

- [**PostgreSQL**](/designs/tech-postgresql/): the link key identifies one authoritative shard. Organizations and the allocator use separate relational records; listing is a derived organization/time index.
- **Local cache:** stores Link copies with expiration and safety state; eviction bounds memory. Popular-link caching compares local memory with [Redis](/designs/tech-redis/).
- [**Kafka**](/designs/tech-kafka/): a replicated event log retains durably collected clicks for worker replay.
- [**ClickHouse**](/designs/tech-clickhouse/): raw events and versioned hourly totals support time-range and dimension reports.

The deep dives explain shard ownership, atomic inserts, cache invalidation and replay-safe aggregation.

## Functional scenarios

### Creating a link

A user submits a long URL and receives a short link such as `https://bit.ly/abc123X`. The creation request can also include a domain and an expiration time.

- **Validate the request.** The web client sends `POST /v4/shorten`. The gateway authenticates the user and checks membership in the organization that will own the link. The creation service validates the destination URL, domain permissions and expiration time, then sets `org_id` to that organization's ID. Invalid input returns 400, denied access returns 403, and exceeding the creation limit returns 429.
- **Generate and save the code.** The creation service takes the next numeric ID from its reserved range and encodes it as seven base62 characters. It inserts the Link record on its authoritative PostgreSQL shard only if that domain-and-code pair has never been assigned. If an alias already uses the generated code, the service tries the next ID.
- **Respond after commit.** Save the Link and a safety-scan job in one transaction, initializing its verdict to `warn`. After commit, return the short link; the job is delivered to a worker for scanning. A service error leaves creation unconfirmed. Generated-code creation has no retry-deduplication contract: after an ambiguous timeout, the user checks their link list; submitting again can create another link.

The new link must work immediately after creation. Redirect reads therefore need read-after-write consistency: a cache miss must reach a database copy containing the committed record. Any cached 404 for the same key must be invalidated. An eventually consistent replica that has not received the write could otherwise report a newly created link as missing.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
sequenceDiagram
  box rgb(232,240,254) Request path
  participant W as Web client
  participant S as Link creation service
  end
  box rgb(230,244,234) Background processing
  participant D as Link database
  participant B as Safety worker
  end
    W->>S: POST /v4/shorten via gateway
    Note over S: Validate URL, alias and expiry
    Note over S: Use alias or ID from a reserved range
    S->>D: Save unique Link and scan job
    D-->>S: Transaction committed
    S-->>W: Short link
    S-->>B: Request background scan
```

The committed Link record makes the code usable with a warning until its first scan completes. The saved job survives a creation-service crash; dispatch retries keep the same job ID.

Calling the allocator for every link would add a network round trip and make creation depend on its availability. Reserving ID ranges moves most allocation work into the service instance; the code-generation deep dive covers durable reservations, refill and collision handling.

### Choosing a custom alias

A user includes `alias: spring-sale` in the link creation request, `POST /v4/shorten`, to request `https://bit.ly/spring-sale`.

- **Validate the request and alias.** Perform the organization-membership, domain-permission, URL and expiration checks described above. Accept letters, digits and hyphens, reject reserved routes, and store the alias as `short_code`. Both user-chosen aliases and generated codes identify Link records, so either kind can already occupy the requested domain-and-code pair.
- **Create the Link record atomically.** Route `(bit.ly, spring-sale)` to its authoritative PostgreSQL shard and insert the complete record under that primary key. The unique index accepts one competing insertion. Retained expired rows keep previously assigned codes reserved.
- **Return the result.** A successful write returns the short link. If the pair is already reserved, return [HTTP 409 Conflict](https://www.rfc-editor.org/rfc/rfc9110.html#name-409-conflict) so the user can choose another alias. A database timeout or outage returns a service error.

The code-generation deep dive shows the uniqueness-checked SQL insert. Both custom aliases and generated codes use that operation, preserving any existing mapping.

An availability preview shows the database state at the time of the check. Another user can submit the same alias before the first user completes the form, causing a race between their creation requests. The atomic write accepts one request and returns a conflict for the other. The UI then asks that user to choose another alias.

The preview adds one database read for early feedback; the conditional write determines whether creation succeeds. Generated codes use the same operation, as explained in the code-generation deep dive.

### Following a short link

When a user follows `https://bit.ly/abc123X`, the web client sends `GET /abc123X` to `bit.ly`. The hostname supplies the domain, giving the lookup key `(bit.ly, abc123X)`. This endpoint is public.

- **Read the link.** Check the local record cache, then read the Link record from the database on a miss. Cache entries use the complete domain-and-code key. A confirmed missing record returns 404; a failed database read returns a server error.
- **Apply link policy.** Check `expires_at` and `safety_status` even when the record comes from the cache. An expired link returns 410, a blocked link returns a 403 page, and `warn` displays a warning. Valid expiration and block responses count as successfully handled requests in the availability target.
- **Return the redirect.** For an allowed, unexpired link, return an [HTTP redirect response](https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx): `301 Moved Permanently`, with the destination in the `Location` header. The web client then requests that URL. Bound browser freshness by the remaining record-validation window, link expiration and safety-verdict freshness; the cache deep dive defines those deadlines.
- **Collect the click asynchronously.** Assign an `event_id` and visit timestamp, then place the event in the publisher's buffer. The service returns the redirect while the publisher sends batches to Kafka. Retries retain the same ID so analytics workers can deduplicate events. Collection becomes durable when Kafka acknowledges the configured replicas; a crash before acknowledgment can lose a click.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
sequenceDiagram
  box rgb(232,240,254) Request path
  participant W as Web client
  participant R as Redirect service
  end
  box rgb(230,244,234) Durable state
  participant D as Link database
  end
  box rgb(232,240,254) External participants
  participant P as Click pipeline
  participant T as Destination server
  end
    W->>R: GET /abc123X on bit.ly
    Note over R: Check local record cache
    opt Cache miss
        R->>D: Read committed link
        D-->>R: Destination URL, expiration and safety status
    end
    Note over R: Check expiration and safety
    R-->>W: HTTP 301 + Location: destination URL
    par Browser follows redirect
        W->>T: GET destination URL
        T-->>W: Destination page
    and Asynchronous click collection
        R-->>P: Publish click event
    end
    Note over R,P: Event can be lost before queue acknowledgment
```

The redirect and destination-page request are separate HTTP exchanges. The click pipeline records collected service events under its asynchronous acknowledgment/loss policy.

With `Cache-Control: private`, cached HTTP redirects are limited to private caches such as the browser; the edge gateway forwards each request it receives. Browser reuse bypasses the service's current checks and click collection. Caching a Link record keeps those checks in the request path.

A popular link can cause many simultaneous cache misses to request the same database record. The hot-link deep dive explains how a local cache and a shared in-flight lookup reduce those repeated reads.

### Setting an expiration

A user sets `expires_at` when creating a temporary link—for example, Friday at 18:00 UTC.

- **Validate and store the deadline.** In `POST /v4/shorten`, validate `expires_at` as a UTC timestamp between five minutes and one year ahead, then save it in the Link record. Invalid input returns 400.
- **Enforce it during redirects.** After reading the record, compare the current time with `expires_at`. At `now >= expires_at`, return 410 Gone. Perform the comparison on local-cache hits as well as database reads.
- **Bound cached responses.** Calculate the browser's `max-age` from the remaining whole seconds before the earliest record-validation, link-expiration or scan-freshness deadline, capped at 90 seconds. If less than one second remains, use `no-store`.

Thus, a redirect issued at 17:59:50 can be cached for at most ten seconds, even though the usual lifetime is 90 seconds.

The hourly cleanup job archives expired destination data while retaining the key and expiration marker. Subsequent requests can still return 410, and the code remains reserved. Request-time checks enforce the deadline independently of cleanup; the cache-policy deep dive covers freshness and invalidation.

### Reading click analytics

A user selects a link in the dashboard and requests click counts for a date range, grouped by hour or day.

- **Authorize and validate the query.** The web client sends the domain, code, `from`, `to` and `units`. The gateway checks organization membership and link ownership before querying analytics. Use an inclusive `from` and exclusive `to`, aligned to the selected UTC reporting boundaries; invalid or reversed ranges return 400.
- **Read saved totals.** Query ClickRollup by domain, code and hourly bucket, then sum `click_count` for the requested period. For daily reports, combine UTC hours and incorporate late events from daily reconciliation. Country and referrer views group the same collected events by their recorded dimensions; missing referrers remain unattributed.
- **Return counts and freshness.** The response includes time buckets, counts and the worker's latest processed time. Display zero after a successful query finds no collected clicks, and an unavailable-data message when the query fails.

The ClickHouse query sums country- and referrer-specific totals into one count per hour. Its named parameters identify the link and reporting interval:

```sql
SELECT bucket, SUM(click_count) AS clicks
FROM click_rollups FINAL
WHERE domain = {domain:String}
  AND link_short_code = {code:String}
  AND bucket >= {from:DateTime} AND bucket < {to:DateTime}
GROUP BY bucket
ORDER BY bucket;
```

The rollup table uses `ReplacingMergeTree(version)` with the ClickRollup key as its sorting key. `FINAL` selects the latest stored version for each row before the query sums its counts.

For example, 12 clicks in the 09:00–10:00 UTC bucket and 8 in the next bucket produce 20 for `[09:00, 11:00)`. Requiring bucket-aligned boundaries prevents an hourly total from being presented as an exact count for part of that hour.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
flowchart TB
    Visits["Collected<br>clicks"]
    Worker["Background<br>worker<br>Build hourly<br>totals"]
    Totals[("Analytics<br>store<br>Saved hourly<br>totals")]
    User["User"] --> Web["Web client"]
    Web -->|"Select link and dates"| API["API gateway<br>Check access"]
    Visits --> Worker --> Totals
    API -->|"Read hourly totals"| Totals
    Totals --> Report["Dashboard<br>report<br>Counts and<br>freshness"]
  classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef background fill:#e6f4ea,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124,stroke-width:1px
  class Visits,User,Web,API request
  class Worker,Totals,Report background
```

The freshness target is to include 98% of events within 90 seconds after durable queue acknowledgment. Each collected event contributes once after deduplication; separate requests by the same user count as separate clicks. Reports cover service-handled requests; browser reuse is outside the collection path.

Scanning raw events for every dashboard query would increase query cost as history grows. An index or equivalent storage ordering on `(domain, link_short_code, bucket)` restricts reads to the selected link and interval; saved hourly totals reduce the number of records to sum. The click-processing deep dive covers deduplication, late events and reconciliation.

Users can browse their organization's links in a paginated list. Destination preview returns the saved URL as data and leaves the click count unchanged.

### Handling unsafe destinations

A destination can become suspicious after a short link is created. Each redirect uses the saved safety verdict to decide whether to continue, display a warning or block navigation.

- **Schedule and perform scans.** Creation requests the first background scan, and recurring jobs recheck recently used destinations. The worker reads the Link's destination and runs the external checks within its scan budget. A timeout leaves verification incomplete and schedules a retry, as described in the safety deep dive.
- **Commit the verdict and invalidate caches.** The worker saves `safe`, `warn` or `blocked` and the scan time, then invalidates that domain-and-code key in service caches. Failed invalidations need retries; until they succeed or an entry expires, requests may still use an older verdict.
- **Apply the current result.** The redirect service checks the verdict after resolving the link. If a user continues from a warning page, that new request reads the authoritative Link record and rechecks expiration and safety before returning a redirect.

| Saved verdict | What the user sees | Next action |
| --- | --- | --- |
| `safe` | Normal redirect | Follow the destination while the link remains valid. |
| `warn` | Warning with the destination shown | If continuing is permitted, recheck expiration and the latest verdict before redirecting. |
| `blocked` | 403 block page | Display the block page and end the request. |

New links start as `warn` until a successful scan records a verdict. A saved scan job is retried after dispatch or worker failure. A `safe` verdict older than 24 hours also displays a warning; `blocked` remains blocked until a successful recheck changes it. Browser-cached redirects remain usable for their freshness lifetime after the origin records a block.

An external check on every redirect would add scanner latency and availability to the request path. Background scans keep that work separate, at the cost of serving an older verdict between checks. The safety deep dive compares the alternatives and their detection limits.

## Deep dives

### Which storage preserves link ownership at this scale?

**Problem.** Forty billion retained mappings need distributed storage, while each domain-and-code pair has one owner and becomes readable immediately after creation. A cache or asynchronously replicated index alone cannot decide who owns an alias.

**Options.**

| Option | Mechanism and benefit | Cost and failure mode |
| --- | --- | --- |
| One PostgreSQL primary | A unique index and transactions enforce claims with a simple read path. | Row/index size, maintenance and failover eventually exceed one machine's operating envelope. |
| Hash-sharded PostgreSQL | Route each complete link key to one logical shard; the shard's primary enforces uniqueness locally. | Routing, resharding and a separate organization listing index become application responsibilities. Two writable owners for one shard would break the claim invariant. |
| Cassandra | Partitioned key lookups scale independently; conditional `IF NOT EXISTS` uses a lightweight transaction to serialize a claim. | Conditional writes add consensus work, and consistency/failover choices must preserve claims and immediate reads. Ordinary eventually consistent writes are insufficient. |

Use hash-sharded [PostgreSQL](/designs/tech-postgresql/). The cached workload reduces the illustrative storage load to about 2.9K reads/s and 580 creates/s; retained data size, rather than an extreme mutation rate, motivates sharding. Familiar transaction semantics simplify permanent code reservation and saved scan jobs. [Cassandra](/designs/tech-apache-cassandra/) remains credible when its distributed operations justify the [conditional-write cost](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html#insert).

**How it works.** Hash `(domain, short_code)` to a fixed logical bucket, then consult a versioned bucket-to-shard map. All claims and uncached redirect reads for that bucket reach its current PostgreSQL primary. A `PRIMARY KEY (domain, short_code)` rejects duplicate claims; cleanup retains a compact row containing the key and expiration state. Organizations and the range allocator use their own relational authority. A committed link event maintains a derived `(org_id, created_at, domain, short_code)` listing index; listing can lag while direct redirects work immediately.

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
flowchart TB
  K["Domain and<br>code"] --> B["Stable bucket"]
  B --> M["Routing map"]
  M --> P["Owning primary"]
  P --> U["Unique insert"]
  P --> R["Immediate read"]
  P --> S[("Synchronous<br>standby")]
  classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124
  classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124
  classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124
  class K,B,U,R request
  class P,S data
  class M control
```

The map identifies one writer; PostgreSQL's unique index is local to that writer. During a bucket move, pause claims for that bucket, copy records and reservations, catch up committed changes, fence the old writer, then publish the new owner. Delayed requests with an old routing version are rejected and retried against the current map. This brief write pause is simpler to verify than overlapping writers.

**Tradeoffs and recovery.** [Synchronous replication](https://www.postgresql.org/docs/current/warm-standby.html#SYNCHRONOUS-REPLICATION) preserves acknowledged claims on eligible standbys, at the cost of replica latency and unavailable creates when durable acknowledgment cannot be obtained. Promote only a standby containing those commits and fence the former primary; [PostgreSQL requires an external failover controller](https://www.postgresql.org/docs/current/warm-standby-failover.html). Reads needing immediate visibility use the primary, not a lagging replica. Measure shard size, unique-claim latency, replica lag, listing lag and the uncached-read fraction; load-test cold-cache traffic separately from the 95% hit assumption.

### Unique short codes

**Problem.** Several creation-service instances can generate links at the same time. Their IDs must remain distinct through crashes and database failover. A generated code can also match an alias chosen by a user, so the Link write must enforce uniqueness even when ID allocation is correct.

**Options.**

- **A central sequence:** increment one durable counter and encode the result in base62. Each creation request makes a database call to obtain its ID. This is the simplest option when that call's latency and availability are acceptable.
- **Random codes or a truncated URL hash:** each instance generates a candidate independently and attempts a uniqueness-checked insert. Collisions require a retry with another candidate. A URL-hash strategy also needs a way to assign distinct codes to separate campaign links that share the same destination. At 40B assignments in a seven-character base62 space, random generation would require roughly 200M collision retries.
- **Allocated ID ranges:** the allocator durably reserves a distinct range for each instance, which generates codes locally from that range. One reservation supports many creations. Durable, non-overlapping reservations preserve uniqueness across crashes.

Reserve ID ranges so an instance can create links from its remaining allocation during a short allocator outage. At 580 creates/s a central sequence is still credible; ranges trade refill coordination and wasted IDs after crashes for fewer allocation dependencies. Every final Link insert still checks custom-alias collisions.

**How it works.**

[Base62](https://en.wikipedia.org/wiki/Base62) represents a numeric ID using letters and digits. We use the alphabet `0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`, with uppercase and lowercase treated as distinct characters. ID `62` becomes `10`, then `0000010` when padded to seven characters. Each instance encodes the next ID from its reserved range:

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
flowchart TB
    Allocator["Atomic,<br>durable<br>ID allocator"]
    Allocator -->|"1–10,000"| A["Instance A<br>Next local ID"]
    Allocator -->|"10,001–20,000"| B["Instance B<br>Next local ID"]
    A -->|"Encode in base62"| Insert["Atomic insert<br>if code is<br>absent"]
    B -->|"Encode in base62"| Insert
    Alias["Custom alias"] --> Insert
  classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef background fill:#e6f4ea,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124,stroke-width:1px
  class A,B,Insert,Alias request
  class Allocator control
```

The allocator uses the IDSequence row with `sequence_id = "generated_links"`. In one PostgreSQL transaction, it advances `next_id` by the range size and returns the previous interval after commit. All instances reserve ranges through this shared row, so their allocations cannot overlap. Acknowledged reservations must survive database failover. After an instance crashes, unused IDs from its range stay reserved because some may already have been issued. [PostgreSQL's atomic updates](https://www.postgresql.org/docs/current/sql-update.html) provide the transaction mechanism; its [sequence documentation](https://www.postgresql.org/docs/current/functions-sequence.html) explains why gaps are acceptable. [Designing Data-Intensive Applications](https://dataintensive.net/) covers the broader coordination.

A 10,000-ID range requires one allocation call for every 10,000 creations, so about 99.99% of link creations avoid that call. At the assumed peak of 580 creates/s, this works out to roughly 0.058 allocations/s across the fleet. An individual instance creating ten links/s would take about 17 minutes to use its full range.

An instance requests another range when 20% of its current range remains. A late refill adds an estimated 5ms to creation. If the instance exhausts its IDs during an allocator outage, creation returns HTTP 503 while refill retries use exponential backoff. Larger ranges tolerate longer outages but leave more unused IDs after crashes. Stop allocation at `62^7` to stay within seven-character codes.

Distinct IDs produce distinct generated codes. A custom alias can still use one of those codes, so every Link creation goes through the primary-key check on its authoritative shard. For a generated collision, consume that ID and try the next one. For a requested alias, return 409.

The shard has a primary key on `(domain, short_code)`. Its [conflict-handling insert](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT) inserts a row only when that key is absent:

```sql
-- $1: domain; $2: code; $3: destination; $4: organization; $5: expiry
INSERT INTO links (domain, short_code, long_url, org_id,
                   created_at, expires_at, version, safety_status)
VALUES ($1, $2, $3, $4, now(), $5, 1, 'warn')
ON CONFLICT (domain, short_code) DO NOTHING
RETURNING domain, short_code;
```

A returned row means insertion succeeded; save its scan job in the same transaction and wait for commit before sending success. No returned row means the key was already assigned. A database error is a service failure. Retaining expired rows prevents old shared links from acquiring new owners.

For comparison, assume a central counter can handle 10K increments/s and that a separate allocator call adds 1–3ms to each creation. That capacity would cover the proposed create load. These figures are inputs to the sizing calculation; actual throughput and round-trip latency require measurement.

**Range-boundary example.** If next_id is 20,001 and the requested size is 10,000, the transaction advances it to 30,001 and returns \[20,001, 30,001). A concurrent reservation then starts at 30,001. Return the interval only after commit; otherwise a rolled-back reservation could still have issued codes.

Associate a stable allocation request ID with the reserved interval. If the response is lost after commit, the instance can recover that same interval instead of ambiguously asking for another. After a process crash, never resume an old interval without reliable issued-ID state; discarding its remainder preserves uniqueness at the cost of gaps.

**Tradeoffs and recovery.** The allocator and Link shard are separate uniqueness boundaries. Allocation gaps are harmless; reissuing an uncertain range is unsafe. Measure remaining range capacity, refill failures and generated/alias conflicts, and recover reservations by stable allocation-request ID before resuming a live instance.

### Popular links

**Problem.** When a link is shared with a large audience, many users request the same destination at once. Caching avoids repeated database reads; the difficult case is the first burst, when several requests arrive before the record has been cached.

**Options.**

- **Indexed database reads:** the simplest path, with one authoritative record. Every redirect still reaches storage, including repeated requests for a hot link.
- **A shared Redis cache:** all instances reuse the same cached record, reducing database reads even when requests land on different instances. Each cache lookup still crosses the network, and the shared cache needs enough capacity and availability to serve the redirect traffic.
- **A local LRU cache with shared in-flight lookups:** each instance serves cached records from its own memory and combines simultaneous misses for the same code into one database lookup. Hits avoid a network call, but every instance has its own cache to warm and must remove stale entries when links change.

Use a local record cache because repeated reads of a small popular-link set can hit without a network hop. Accept independent warm-up and invalidation per instance. LRU eviction removes the least recently used records when memory fills up.

**How it works.** On a miss, one request starts the database lookup; other requests for that key on the same instance await its result. This coordination is called singleflight. It bounds per-instance duplicate work, while a fleet-wide cold burst can still cause one lookup per instance.

```text
resolve(domain, short_code):
    key = (domain, short_code)
    if local_cache contains key:
        return cached_record
    return singleflight(key, lookup_in_database)
```

Singleflight combines concurrent lookups within one instance; each other instance warms its own cache. A watcher can preload a suddenly popular link into those caches to reduce the fleet's initial database lookups. The proposed trigger is 10K requests/s per instance, with about 100ms budgeted to distribute the update. The cache uses at most 25% of the instance's heap, and each shared lookup has a five-second deadline that bounds how long requests wait for a stalled fetch.

When a link changes, an invalidation message tells each instance to remove its cached record. Failed deliveries need retries and a bounded TTL, so stale records eventually expire. Requests for many distinct, uncached links still reach PostgreSQL; cold-start and eviction tests establish how much of that traffic storage can handle.

**Cold burst versus sustained misses.** On one instance, 1,000 simultaneous requests for a cold link can share one database lookup and receive the same result. Across 200 cold instances, ordinary singleflight can still produce up to 200 lookups. Prewarming or a shared fill coordinator addresses that fleet-wide burst if measurements justify the added component.

Store record version and expiry with each cached value. A lookup begun for version 10 must not repopulate the cache after version 11's invalidation; retain a versioned tombstone or compare the invalidation generation before accepting the fill.

**Tradeoffs and recovery.** Bound cache fills by the request's remaining deadline; the five-second cleanup ceiling is a resource-retention limit, not permission to hold a redirect beyond its normal latency budget. Cancel abandoned waits, cap in-flight distinct keys and measure fill latency, coalesced misses and evictions. Keep a record-cache TTL of at most 90 seconds, shortened to link expiration, to bound missed invalidation exposure.

### Redirect cache policy

**Problem.** Caching a Link record keeps expiration and safety checks on the request path. Caching an HTTP redirect lets a browser or edge reuse an earlier navigation instruction, bypassing the service's current checks and click collection.

**Options.**

| Cache | What it stores | Control and limits |
| --- | --- | --- |
| Service | Link record | Hits avoid database reads while each request checks policy; invalidation/TTL bound stale records. |
| Edge | HTTP redirect | Saves service traffic, but requires purge propagation and edge click collection; neither exists in the selected request path. |
| Browser | HTTP redirect | Saves repeat network requests; the service cannot revoke an issued response before its cache deadline or observe reused visits. |

Use service-side record caching and private browser reuse for safe links, with shared redirect caching disabled. This keeps most database work off the read-heavy path while every non-browser-cached request checks policy and collects a click. Accept up to 90 seconds of browser reuse and its unobserved visits; a strict immediate-revocation product would instead use `no-store` for all redirects.

**How it works.** An authoritative lookup establishes a record-validation deadline at `fetched_at + 90s`. Cache hits preserve that deadline. Set browser `max-age` to the remaining whole seconds before the earliest of that deadline, link expiration and `last_scanned_at + 24h`, capped at 90 seconds. Thus an old record near the end of its TTL cannot start another full browser TTL. The `private` directive limits storage to private caches ([HTTP cache rules](https://www.rfc-editor.org/rfc/rfc9111.html#name-private)). With less than one second remaining, use `no-store`, as for warning/block pages and explicit warning continuation. The 95% hit-rate sizing value is an assumption, not guaranteed effectiveness.

HTTP 301 is [cacheable without explicit freshness](https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently), and HTTP 302 can also be cached when the response policy allows it. Both therefore need explicit cache controls. A committed safety change invalidates service records, while already-issued browser responses remain reusable until their bounded deadline. Warning and block pages use `no-store`.

**Expiration-bounded response.** A link expires at 12:00:45 and is requested at 12:00:00. A proposed 90-second browser lifetime is shortened to at most 45 seconds. The redirect record is checked before response generation, and the Cache-Control lifetime ends no later than the link deadline.

A later blocked verdict invalidates service records, but an issued private browser response may remain reusable for its remaining lifetime. If invalidation is lost, the shared validation deadline bounds record-plus-browser exposure to at most 90 seconds after the last authoritative lookup. Changing 301 to 302 without cache controls does not establish immediate safety updates.

**Tradeoffs and recovery.** Keep response-cache policy separate from record-cache policy. A safety change invalidates service records; TTL bounds failed deliveries, but browser responses retain their remaining lifetime. Track invalidation lag and collected-request coverage; the service can measure its cache hits but cannot directly count visits hidden by browser reuse. Shared caching would require a separate purge/collection contract before enablement.

### Click processing

**Problem.** Waiting for an analytics write adds redirect latency and couples navigation to analytics availability. Returning first leaves a crash window before the click becomes durable.

**Options.**

- **Update a counter synchronously:** commit the click-counter update before returning the redirect. This keeps counting simple, but adds write latency to each request and makes navigation depend on the analytics store.
- **Buffer events and publish asynchronously:** return the redirect promptly, then batch click events into a durable queue. Analytics processing runs independently of the response. Events awaiting queue acknowledgment remain vulnerable to a process crash.
- **Wait for durable recording before responding:** the service waits for the queue to confirm that it has saved the event before returning the redirect. This removes the pre-acknowledgment loss window for successful responses, but adds queue latency to every visit and makes navigation depend on the queue's availability.

Buffer clicks and publish asynchronously to Kafka; workers save events in ClickHouse and rebuild hourly totals. Best-effort campaign analytics and the redirect latency target justify pre-acknowledgment loss. Billing-grade collection would instead wait for a durable acknowledgment before returning success.

**How it works.**

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e8f0fe","primaryBorderColor":"#9aa0a6","primaryTextColor":"#202124","secondaryColor":"#e6f4ea","tertiaryColor":"#fef7e0","lineColor":"#5f6368","actorBkg":"#e8f0fe","actorBorder":"#9aa0a6","actorTextColor":"#202124","noteBkgColor":"#fef7e0","noteBorderColor":"#9aa0a6","noteTextColor":"#202124","signalColor":"#5f6368","signalTextColor":"#202124"}}}%%
flowchart TB
    Response["Redirect sent"] -.-> Buffer["Click event<br>in RAM buffer"]
    Buffer -->|"Publish"| Queue["Queue confirms<br>durable<br>storage"]
    Queue --> Worker["Worker updates<br>hourly totals"]
    Buffer -.-> Loss["Crash before<br>confirmation:<br>event may be<br>lost"]
  classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef background fill:#e6f4ea,stroke:#9aa0a6,color:#202124,stroke-width:1px
  classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124,stroke-width:1px
  class Response,Loss request
  class Buffer,Queue,Worker background
```

#### Technologies and event flow

- **Kafka retains and distributes events.** Publishers send batches to a replicated `click-events` topic with `acks=all`, replication factor 3 and `min.insync.replicas=2`. These proposed settings acknowledge a batch after the required in-sync replicas have stored it. Partition by `event_id` to distribute even a popular link's clicks across workers.
- **Analytics workers enrich and save events.** A Kafka consumer group shares the partitions. Each worker derives country with a local GeoIP lookup, extracts the referrer domain and inserts a batch into ClickHouse. It commits its Kafka offsets—the positions through which it has read—after ClickHouse acknowledges the insert. A crash can replay a batch, so events retain their original `event_id`.
- **ClickHouse builds reports.** Store raw events in `ReplacingMergeTree`, partitioned by their original event date and ordered by `(domain, link_short_code, timestamp, event_id)`. Retries keep these fields unchanged. [Query-time deduplication with ](https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/replacingmergetree#query-time-de-duplication--final)[`FINAL`](https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/replacingmergetree#query-time-de-duplication--final) removes duplicate deliveries before aggregation. Rebuild affected hourly totals as versioned snapshots keyed by the ClickRollup fields; report queries select the latest version of each total instead of adding replayed counts.

This uses Kafka consumers and scheduled aggregation jobs. [Flink](/designs/tech-flink/) is an alternative for continuously maintained event-time windows and checkpointed processing. Its [Kafka connector](https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/kafka/) supports checkpoint-based recovery, but the ClickHouse output still needs replay-safe writes. Add that processing layer when windowing complexity justifies it.

The aggregation below rebuilds one affected hour from deduplicated events:

```sql
SELECT domain, link_short_code,
       toStartOfHour(toTimeZone(timestamp, 'UTC')) AS bucket,
       country, referrer_domain, COUNT(*) AS click_count
FROM click_events_raw FINAL
WHERE timestamp >= {hour_start:DateTime}
  AND timestamp < {hour_end:DateTime}
GROUP BY domain, link_short_code, bucket, country, referrer_domain
```

The publisher sends a batch at 1,000 events or after 100ms, whichever comes first. Cap the buffer at an estimated second of peak per-instance events and drop new events on overflow, incrementing a loss metric while redirects continue. A crash can lose all unacknowledged events; a long queue outage can lose every new click after the buffer fills. The 90-second freshness target begins after durable acknowledgment, not navigation, and supplies no guarantee about uncollected visits.

Synchronous analytics writes are estimated to add 2–5ms to each redirect. A browser beacon would move collection to the client and change the navigation flow, with an assumed 10–30% event loss from tracking blockers. Adopting it would require evaluating those collection semantics and losses separately.

An event can arrive after its reporting hour has ended. Retain it in the canonical raw-event set with its original event date and stable ID. Within five minutes, rebuild its original hourly bucket; older arrivals also enqueue that hour for daily reconciliation. Reconciliation reads the same deduplicated raw set and publishes a newer absolute hourly total. Daily reports sum these corrected hourly rows, so late-event counts are incorporated once rather than joined as a second additive total. Storage compaction changes layout; it does not perform this correction.

A worker that saves a batch and crashes before committing its Kafka offsets reads that batch again after restarting. Deduplicating by `event_id` and rebuilding totals prevents those retries from increasing the count. Two genuine clicks can share a timestamp and IP, so those fields cannot identify an event reliably. A transactional-counter alternative must save the processed ID and increment the count in the same transaction. Kafka's [delivery-semantics documentation](https://kafka.apache.org/42/design/design/#message-delivery-semantics) explains why writes to an external database require this coordination. These guarantees cover collected events; browser-reused visits remain outside the collection path.

**Versioned rollup correction.** Suppose hour H contains 100 deduplicated events and publishes rollup revision 1. A late event adds one genuine click. Rebuild the affected hour to absolute count 101 and publish revision 2; a report selects the latest revision rather than adding 100 and 101.

If an insert succeeded before the worker crashed, replay preserves each event's identity and original ordering fields. Query-time deduplication removes that duplicate before rebuilding. A reconciliation generation must sort after the streaming generation it corrects, so a delayed old aggregation cannot replace the newer result.

**Tradeoffs and recovery.** Store each publication's source cutoff and completion state with its rollup version. Replay retains stable event identities and rebuilds absolute counts; it cannot recover events never durably collected. Measure queue lag, dropped buffer events, replay volume, late-event corrections and commit-to-report delay, and show processing freshness alongside counts.

### Link safety

**Problem.** A destination can change after creation. Detecting that change needs another scan; scanning every redirect adds external latency and an availability dependency.

**Options.**

- **Scan only at creation:** cheap and simple, but a later change can go undetected indefinitely.
- **Check externally on every redirect:** request the freshest available verdict before returning a redirect. Navigation then depends on the scanner's latency and availability. Detection is limited to threats already known to the provider.
- **Rescan in the background and cache results:** check destinations periodically and update cached records when a verdict changes. Each redirect uses the saved verdict, keeping external scanner latency off the request path. Visits between scans may use an older verdict after a destination changes.

Scan in the background and store a versioned verdict, scan time and intelligence version. This preserves redirect responsiveness despite variable scanner latency. New and stale-unverified destinations display a warning; known blocked destinations remain blocked until a successful recheck changes them. Accept the gap between checks and the detection limits of available intelligence.

**How it works.**

A scan follows up to five redirect hops and collects the destination's title and content type, combining those signals with threat intelligence before writing a verdict to the Link record. The starting scan budget is 1–5s. After a crawl timeout, the worker consults the threat API and schedules another scan, leaving verification incomplete. It rescans links visited in the previous 30 days once a day, focusing recurring work on recently active destinations.

Initialize a new Link as `warn` with no `last_scanned_at`. Persist the scan job with creation so a worker can retry it. A completed scan marks `safe` only when checks pass; a definitive malicious match marks `blocked`, and uncertain evidence keeps `warn`. A previously safe verdict older than 24 hours becomes a warning at request time. Scanner failure leaves the prior verdict and scan time unchanged.

A definitive blocklist can identify a known unsafe destination for rejection. A counting Bloom filter first narrows the lookup to possible matches, which require a definitive check because the filter can produce false positives. The same distinction applies if a filter is used to check whether an alias is taken: the final lookup establishes membership. [Bitly's dablooms](https://word.bitly.com/post/28558800777/dablooms-an-open-source-scalable-counting) provides the counting-filter background. Newly emerging threats remain a detection gap until a scan or feed update identifies them.

The proposed creation limits are 100 requests/minute per organization and five concurrent connections per IP. Exceeding a limit returns 429 with `Retry-After`. Use definitive malicious matches for blocking; a timeout is incomplete verification and follows the warning policy.

**Safe scanner execution.** Fetching a user-submitted destination is a server-side network operation, so the scanner needs a constrained egress boundary. Validate scheme and resolved destination before connecting, block internal/loopback/link-local addresses, and repeat validation at every redirect hop. Bound response bytes, decompressed size, time and redirect count.

A scan job carries the Link version and destination read together. If the destination or verdict changes while scanning, the old job cannot overwrite the newer state. Commit the verdict, scan time and incremented Link version only when the expected version still matches; save that version's invalidation event in the same transaction. A conflict schedules a fresh scan of the current record.

**Tradeoffs and recovery.** The warning policy permits informed continuation when verification is incomplete, so it is weaker than prohibiting all unverified navigation. A successful scan is evidence about one destination version and time, not a permanent guarantee. Measure scan age, job backlog, definitive matches, failed egress checks and invalidation delay. Retry saved jobs with bounded backoff, and recheck current expiration/verdict on warning continuation.
