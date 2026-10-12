---
layout: post
title: "SD: Video Conferencing (Zoom)"
category: system-design
date: 2026-07-07
tags: [Video-Conferencing, WebRTC, Real-Time, Zoom, Meeting-Systems, SFU]
thumbnail: /images/posts/system-design-video-conferencing-zoom.svg
last_modified_at: 2026-10-11
description: "Design of a meeting service with live audio, video, screen sharing, chat and optional recording."
notion_source: https://app.notion.com/p/395d865005a8819d84b0d7e67f55a378
---

Design of a meeting service with live audio, video, screen sharing, chat and optional recording.

<!--more-->

## Problem

Users need to join a meeting quickly, hear each other clearly and share content across home, mobile and corporate networks. Each participant has a different connection and device, so the service must adapt the streams delivered to each receiver.

Meeting setup and host controls need reliable delivery. Live audio and video need to arrive in time for playback, so they use a separate transport that can favor timely packets over retransmitting outdated media.

## Requirements

### Functional requirements

- **Manage meetings:** create and join meetings, maintain the participant roster and enforce host permissions.

- **Exchange media:** send microphone and camera streams and receive other participants' audio and video.

- **Share a screen:** show a participant's screen alongside the meeting's camera feeds.

- **Adapt quality:** adjust video quality and preserve audio as network conditions change.

- **Chat and react:** deliver meeting messages and lightweight reactions.

- **Record a meeting:** save permitted audio, video and screen content for authorized users.

### Non-functional requirements

Design targets:

- **Scale:** 10M concurrent participants, including meetings with up to 1,000 participants.

- **Latency:** capture-to-playback delay under 150ms at p95 for supported regional network conditions; join within three seconds at p95.

- **Availability:** 99.9% for meeting setup; target media recovery within five seconds after a single media-server failure.

- **Security:** authenticated access and encrypted connections; optional end-to-end encryption (E2EE) keeps media decryption keys with authorized participants.

- **Resilience:** reduce video quality and preserve audio during congestion; display reconnection state when a path fails.

Intercontinental propagation, device processing and restrictive networks can exceed the latency target. Webinars, telephone dial-in and breakout rooms are outside this design.

## Back-of-the-envelope calculations

- **Media ingress:** 10M × 2Mbps average uplink = 20Tbps, before transport overhead.

- **Stream deliveries:** if all 20 participants receive everyone else's stream, the meeting has 20 × 19 = 380 receiver/stream relationships. Outbound bandwidth depends on visible tiles and their selected bitrates.

- **Connectivity relay traffic:** a relay carries media when a device cannot connect directly to the media server. With 10% of participants relaying 2Mbps in each direction, about 4Tbps of media payload crosses the relay path. Relay interfaces handle about 4Tbps ingress plus 4Tbps egress before overhead. The design uses [TURN](https://www.rfc-editor.org/rfc/rfc8656.html), the standard protocol for this relay path; measure the actual relay share and downstream bitrate mix.

- **Recording:** 5M recordings/day × 45 minutes × 1.5Mbps / 8 ≈ 2.5PB/day for one retained media stream per recording. Recording several streams separately multiplies this by the retained stream count.

Bandwidth, recording retention and per-meeting stream deliveries determine capacity; server counts require measured forwarding throughput.

## Core entities

A **track** is one microphone, camera or screen stream. The model records which participants belong to a meeting, which tracks they send and which media server handles each participant's connection.

- **Meeting:** access policy, host and current lifecycle state.

- **Participant:** identity and permissions within a meeting.

- **Media session:** the participant's connection and assigned media server.

- **Recording:** retained track objects, consent and processing state.

```protobuf
message Meeting {
  string meeting_id;
  string host_user_id;
  string status;
  string encryption_mode;         // Transport or end_to_end
  Timestamp created_at;
}

message Participant {
  string participant_id;
  string meeting_id;
  string user_id;
  string role;
  bool recording_consent;
}

message MediaSession {
  string session_id;
  string participant_id;
  string forwarding_node;          // Assigned media server
  int64 assignment_epoch;          // Media-server assignment version
  repeated string published_tracks; // Tracks this participant sends
}

message Recording {
  string recording_id;
  string meeting_id;
  string status;
  repeated string track_objects;  // Storage references to the saved tracks
  Timestamp started_at;
}

message ChatMessage {
  string message_id;
  string meeting_id;
  string sender_id;
  int64 sequence;                  // Order of messages within the meeting
  string body;
}

```
## API

HTTP endpoints manage meetings and recordings. A persistent, two-way [WebSocket connection](https://datatracker.ietf.org/doc/html/rfc6455) carries connection-setup messages—[signaling](#how-do-meetings-survive-restrictive-networks)—alongside host controls, chat and reactions. Audio and video use a separate encrypted media connection.

```yaml
POST /v1/meetings:
  body: {access_policy: object, encryption_mode: string}
  response: {meeting_id: string, join_url: string}

POST /v1/meetings/{meeting_id}/join:
  body: {user_token: string, device_capabilities: object}
  response: {participant_id: string, session_token: string,
             signaling_url: string, media_server: string}

WebSocket /v1/meetings/{meeting_id}/signal:
  message_categories: [connection_setup, track_selection, host_controls, chat, reactions]

POST /v1/meetings/{meeting_id}/recordings:
  headers: {Idempotency-Key: request_id}  # Identifies one recording-start request
  response: {recording_id: string, status: starting}

POST /v1/recordings/{recording_id}/stop:
  response: {status: processing}

GET /v1/recordings/{recording_id}:
  response: {status: string, authorized_download_url: string}

```

Connection negotiation and [retry/reconnect handling](#how-do-retries-and-reconnects-preserve-the-current-session) are covered in the deep dives.

## High-level design

The meeting service checks access and assigns a media server to each participant. Each participant sends its streams to that server, which forwards the streams requested by receiving devices. Each device keeps one media-server connection as the meeting grows. This forwarding role is called a [selective forwarding unit (SFU)](https://www.rfc-editor.org/rfc/rfc9605.html#section-6.1).

A device tells the SFU which streams it wants to receive as the user changes the meeting layout. A recording worker receives authorized streams and saves them; meeting and chat records use separate storage.

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
    U["User devices"] -->|"Join and controls"| M["Meeting service"]
    M --> D[("Meeting and chat state")]
    M -->|"Media-server assignment"| S["Media server (SFU)"]
    U -->|"Audio, video and screen"| S
    S --> R["Receiving devices"]
    S -->|"Authorized streams"| W["Recording worker"]
    W --> O[("Recording storage")]
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
class U,S,R request;
class D,W,O data;
class M control;

```
## Storage

- **Relational database — [PostgreSQL](/designs/tech-postgresql/):** meeting metadata, permissions, recording jobs and retained chat need durable transactions and indexed access by meeting. Store current server assignments and command results here so recovery state survives service restarts.

- **In-memory key-value store — [Redis](/designs/tech-redis/):** cached media-server assignments and connected-participant lists need fast lookups and expiry. These are short-lived coordination records; durable permissions and assignments remain in PostgreSQL.

- **Object storage:** immutable recording segments and final outputs need large sequential writes and authorized downloads.

- **Durable job queue:** stores pending recording-finalization and retention jobs so workers can retry them after a crash, separately from the live meeting.

Chat retention follows the meeting policy. Media packets remain in bounded transport and retransmission buffers; recording is an explicit operation.

## From request to response

### Meeting join and media flow

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
sequenceDiagram
  participant U as Joining device
  participant M as Meeting service
  participant F as Media server (SFU)
  participant R as Receiving device
  rect rgb(254, 247, 224)
    U->>M: Join meeting
    M-->>U: Session token and media-server assignment
    U->>M: Propose media settings and possible addresses
    M->>F: Relay the proposal
    F-->>M: Accepted settings and possible addresses
    M-->>U: Relay the response
  end
  rect rgb(232, 240, 254)
    U->>F: Establish encrypted connection and send tracks
    R->>F: Request the tracks needed for the layout
    F-->>R: Forward selected tracks
    R-->>F: Loss and bitrate feedback
    F->>F: Adjust forwarded video quality
  end

```

The meeting service authorizes the join and relays setup messages to the assigned SFU. The device then establishes its media connection, sends its tracks and requests the tracks it wants to receive. The SFU forwards those selected streams; a TURN relay can carry the connection on restrictive networks.

### Joining a meeting

The client authenticates and submits the meeting ID. The meeting service checks access and capacity, creates a participant session and returns a short-lived token for the control connection and a media-server assignment.

The device completes connection setup with its assigned media server, then starts sending and receiving tracks. On reconnect, it keeps its participant identity while establishing a new connection. The deep dives explain [path selection](#how-do-meetings-survive-restrictive-networks) and [session-version checks](#how-do-retries-and-reconnects-preserve-the-current-session).

### Sending and receiving audio and video

The client compresses each track for transmission using a **codec**, an audio or video encoder/decoder. Sending a track is called **publishing**; requesting another participant's track is **subscribing**. For video, it can send separately encoded quality versions, or a base stream with additional layers of detail. The SFU selects the version or layers that fit each receiving device's bandwidth.

The SFU uses each receiver's requested tracks and network feedback to select what it forwards. Receivers briefly queue incoming packets to smooth arrival-time variation, then decode and play the streams. The quality-control deep dive explains how those versions and layers are encoded and selected.

Audio receives priority during congestion. Forwarding all camera streams at full quality grows downstream bandwidth rapidly; selective subscriptions and layer selection address that cost.

### Sharing a screen

A user with permission publishes a screen track alongside the camera. The client selects encoding settings appropriate to text or motion. Receiving clients update their layouts, and the SFU adjusts the forwarded tracks and video quality to match their requests.

Stopping sharing unpublishes that track. Host controls request a permitted action; device permissions and the user's microphone/camera controls remain enforced by the client.

### Sending chat and reactions

The meeting service validates membership and assigns a sequence to a retained chat message before acknowledging it. Repeated message IDs return the existing result. Reconnecting clients request messages after their last sequence.

Reactions are short-lived events and can tolerate loss. Separating their retention prevents high reaction rates from expanding the durable chat log.

### Recording a meeting

The host starts an authorized recording and participants see its state and consent requirements. A recording subscriber receives permitted tracks and writes segments. It keeps an index of completed segments, called a **manifest**, so work can resume after an interruption. Finalization assembles the output and updates the recording status.

Transport-encrypted meetings can support a trusted cloud recorder. End-to-end encrypted meetings require an explicitly authorized key-holding recorder or client-side recording, according to the meeting policy.

## Deep dives

### Which media topology fits group meetings?

A group call creates many subscriptions, and users have limited uplink and decoding capacity.

- **Peer-to-peer mesh:** Send a separate copy from each publisher to every peer. Small calls avoid a forwarding server, but uplink and connection count grow with participants.

- **Server mixing:** Decode streams and encode a composite for each needed layout. Receiver decoding can be lighter, but server compute, latency and end-to-end trust constraints increase.

- **Selective forwarding — recommended:** Forward existing encoded streams and select subscriptions/layers per receiver. Server encoding work is avoided; receiver bandwidth and decode limits still require bounded visible tiles and layer choices.

In a 20-person mesh, sending a 2Mbps camera stream separately to 19 peers requires 38Mbps of upload bandwidth per participant. Selective forwarding sends a bounded set of quality versions to one media server, which distributes them to receivers. We choose it because client upload bandwidth and server encoding capacity are limited. The cost moves to server outbound bandwidth and per-receiver subscription state; mixing remains useful for authorized recording or constrained clients.

Media travels in packets carrying sequence numbers and playback timestamps, using [Real-time Transport Protocol (RTP)](https://datatracker.ietf.org/doc/html/rfc3550). These let receivers order packets and align playback. Bound visible video subscriptions so each device stays within its receive-bandwidth and decoding capacity.

Many compressed video frames describe changes relative to earlier frames. Switching quality versions can leave a receiver missing those references. The SFU switches at an independently decodable **keyframe**, or another switching point supported by the codec, and keeps a bounded history of recent packets for retransmission.

**What the SFU forwards**

A publisher sends video using **simulcast**, several independently encoded quality versions, or **scalable video coding**, a base layer with enhancement layers that add quality. The SFU forwards a suitable version or decodable set of layers for each subscription: high quality for a large active-speaker tile, lower quality for a small mobile tile. Receiving devices decode their selected streams and compose their own meeting layouts.

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
    P["Publisher<br>encoded layers"] --> S["SFU<br>per-receiver subscriptions"]
    S --> A["Receiver A<br>active speaker high layer"]
    S --> B["Receiver B<br>mobile low layer"]
    S --> C["Receiver C<br>audio plus selected tiles"]
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
class P,S,A,B,C request;

```

On a layout change, the receiver requests a new subscription. The SFU requests a keyframe when needed for the switch and drops retransmissions after their playback deadline. Measure sender upload bandwidth, SFU outbound bandwidth and receiver decoding load separately.

### How do meetings survive restrictive networks?

A direct media path sends individual packets without waiting for transport-level retransmission, using **User Datagram Protocol (UDP)**. This suits time-sensitive audio/video. A home router may translate a device's private address to a public address; this is **network address translation (NAT)**. That translation and firewall rules can make some advertised addresses unreachable. Connectivity checks, called [Interactive Connectivity Establishment (ICE)](https://www.rfc-editor.org/rfc/rfc8445.html), find a usable device-to-server path.

- **Direct transport only:** Use a direct supported media candidate. Relay spending is low, but restrictive NATs or firewalls prevent some participants from connecting.

- **Relay every session:** Route all media through TURN infrastructure. Connectivity handling is uniform, but even reachable sessions pay relay bandwidth and an extra network path.

- **ICE with relay fallback — recommended:** Check candidate pairs and use a working direct or TURN path. Most sessions can avoid unnecessary relay; candidate setup, relay capacity and connectivity metrics remain required.

Participants use heterogeneous enterprise and mobile networks. We accept connectivity-check setup and provision measured TURN capacity so reachability does not depend on one assumed UDP path.

**How connection setup works**

Before audio or video can flow, the client and its assigned media server agree on supported media formats and exchange network addresses they can try. This setup exchange is [**signaling**](https://www.rfc-editor.org/rfc/rfc8829.html#section-1.1). The meeting service relays these messages over the client's WebSocket control connection. Browser clients use [Web Real-Time Communication (WebRTC)](https://www.w3.org/TR/webrtc/) to negotiate media settings, test connectivity and establish the encrypted media connection.

The client proposes media formats and connection settings in an `offer`; the media server returns its accepted settings in an `answer`. Each endpoint advertises possible network addresses in `ice_candidate` messages. ICE sends test packets across these device/server address pairs and selects a working direct or TURN-relayed path. Once connected, the client requests the tracks it wants to receive using `subscribe`.

Deploy TURN near users and require short-lived credentials. A client reserves a temporary relay address through a **TURN allocation**; monitor those reservations, relay bandwidth and transport mix. For restrictive networks, TURN can use **Transmission Control Protocol (TCP)**, encrypting the connection and authenticating the relay server with **Transport Layer Security (TLS)**. TCP delivers data in order, so a missing packet can delay newer media behind its retransmission; this is **head-of-line blocking**.

**Connection establishment and network change**

When a phone moves from Wi-Fi to cellular, its earlier media path may stop working. The client and SFU exchange fresh connection credentials and addresses through signaling, then repeat connectivity checks. This renewal is an **ICE restart**; it replaces the media path while preserving the meeting session.

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
  S["Signaling exchange"] --> G["Gather direct and TURN candidates"]
  G --> C["Check candidate pairs"]
  C --> N["Select a working path"]
  N --> M["Secure media transport"]
  M -->|"Network change"| R["ICE restart<br>new credentials and candidates"]
  R --> C
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
classDef danger fill:#fce8e6,stroke:#9aa0a6,color:#202124;
class S,G,C,N,M,R request;
```

Monitor the control connection and media path separately: either can fail while the other remains available. Record the selected address type, the time for a packet and reply to complete a round trip (**RTT**), packet loss and relay use to locate connectivity failures.

Expire relay allocations and enforce per-user abuse limits. Test enterprise firewalls and Wi-Fi-to-mobile handoff with real clients. After a path changes, estimate its capacity before restoring the previous video bitrate.

### How do retries and reconnects preserve the current session?

A client can lose a response after a command succeeds, and messages from an old connection can arrive after a reconnect. The service must recognize a repeated request while keeping delayed messages from changing the current session.

- **Retry each command as a new request:** little retained state, but a repeated recording-start or chat submission can create duplicate work.

- **Deduplicate within the live connection:** inexpensive and useful for local retries, but the cache disappears on restart and a reconnect creates a new connection.

- **Stable request IDs and service-checked versions — recommended:** retain command outcomes and check the current connection and server assignment. Retries recover the original result, while obsolete commands are rejected. This requires durable state, atomic updates and a bounded retention policy.

Meetings frequently reconnect and can outlive a service process. We choose stable request identities plus independent versions so a reconnect preserves the participant, a retry preserves its original operation, and a reassignment takes effect once. PostgreSQL owns the durable records; Redis caches copies for fast routing. Media servers retain established connection state during a temporary cache or placement-controller outage.

Each control message carries a unique `command_id`. The current connection version is `session_epoch`; reconnecting advances it. The media-server assignment version is `assignment_epoch`; changing servers advances that separately. New commands must match the current versions, keeping delayed messages from changing the current session. The join response includes both versions so the client can attach them to subsequent control messages.

```yaml
command: offer | answer | ice_candidate | subscribe | host_control | chat | reaction
command_id: client_generated_id
session_epoch: current_connection_version
assignment_epoch: current_server_assignment_version
payload: command_specific_data
```

The service first authorizes the caller and checks for a saved result under the request ID. Repeating the same operation returns that result, including after a reconnect. Scope IDs to the requesting participant or user, compare the submitted operation, and reject reuse for different input.

For a new persisted operation, a PostgreSQL transaction locks the participant's session row, checks the current versions and records the command ID, its effect and the response together. Reconnect and reassignment updates take the same row lock, serializing those changes with the command. Live media-server commands are serialized against that server's current session state so a reconnect or reassignment cannot occur between the version check and the change. A timeout after commit can therefore be retried safely; a database outage leaves new durable operations unavailable until storage recovers.

A client-generated `Idempotency-Key` identifies a recording-start request so retrying it returns the same recording job. A PostgreSQL transaction saves each chat message with its unique ID and meeting-local sequence. Reconnecting clients replay messages after their last sequence; a repeated message ID returns the existing message. Retain command results through the supported retry window. Clients stop automatic retries once that window closes and show an unresolved outcome for recovery. Measure duplicate-result hits, rejected old-version commands and replay lag.

### How do we keep quality consistent across receivers?

A fast connection and a congested mobile connection can subscribe to the same publisher.

- **One fixed quality:** Publish and forward one bitrate/resolution. Operation is simple, but a congested receiver stalls or a fast receiver receives unnecessarily low quality.

- **Per-receiver transcoding:** Decode and re-encode a tailored stream for every receiver. Adaptation is flexible, but compute and latency scale with subscriptions.

- **Encoded layers with receiver feedback — recommended:** Select a simulcast or scalable-codec layer per subscription and adjust sender bitrate as needed. Heterogeneous receivers share published layers; publishers spend extra encoding/uplink and transitions need congestion control.

A meeting contains different devices and bandwidth conditions. We accept layer-management and publisher overhead to preserve audio and useful visible video without individualized server transcoding.

Receiving devices report packet arrivals and losses. The SFU combines these reports with the delay in its outgoing packet queue to estimate each receiver's available bandwidth. It reduces forwarded video bitrate as congestion grows. Receivers briefly hold arriving packets to smooth timing variation; this **jitter buffer** has a fixed delay budget so buffering preserves the playback target.

**Allocate bandwidth per receiver**

Reserve the estimated bandwidth for audio first, then screen content or the active speaker, then other selected tiles. Choose encoded layers that fit the remaining capacity; request a lower sender bitrate when the available versions are too large.

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
  B["Estimate receiver bandwidth"] --> A["Reserve audio bandwidth"]
  A --> P["Select screen-share or active-speaker layers"]
  P --> T["Fit secondary tiles within remaining capacity"]
  T --> F["Receiver arrivals/loss<br>SFU queue delay"]
  F --> B
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
classDef danger fill:#fce8e6,stroke:#9aa0a6,color:#202124;
class B,A,P,T,F request;
```

Require sustained spare bandwidth before upgrading quality; this **hysteresis** prevents small fluctuations from repeatedly switching layers. Downgrade sooner when loss or queue delay rises, and stop retransmitting packets after their playback deadline. Longer jitter buffering adds conversation delay, so keep it within the playback budget.

Each receiver has its own quality selection; sender processing and upload capacity still limit the available versions. Test packet loss, bursty delay, mobile handoff and changing layouts. Measure audio interruptions and frozen-frame time alongside bitrate.

### How do we route a meeting across regions?

One region is operationally simple, but users far from that region pay extra propagation delay.

- **One meeting region:** Keep all media on one regional forwarding group. Ownership and relay relationships are simple, but distant participants pay additional propagation delay.

- **Independent nearest-server placement:** Attach each participant to the nearest available SFU. Access paths are short, but participants spread across many nodes can require many node-to-node relay connections and separate copies of the same stream.

- **Regional SFU groups — recommended:** Group nearby participants on a regional set of media servers. Combine their requested tracks so each required stream crosses regions once per receiving group, then distribute it locally. This bounds relay copies, while routing and recovery must preserve subscriptions and server-assignment versions.

Large meetings can span regions while only selected tracks are visible. We accept cross-region routing state and measured relay bandwidth, keeping small local meetings on the simpler one-region path.

The meeting service's **placement controller** chooses a media server using participant locations, capacity and data-residency requirements, and records the assignment version. Media servers retain current connection and subscription state so established media can continue during a controller restart.

On SFU failure, clients receive a new assignment, establish a new transport and republish or resubscribe. Capacity reserves and regional admission limits keep failover from overloading healthy nodes. Measure recovery against the five-second target under the supported network conditions.

**A cross-region subscription**

Assign each participant to a nearby SFU with available capacity. An **inter-region relay** carries the required streams between regional SFUs when subscribers are in another region; the receiving SFU distributes them locally. This connects media servers to one another, while TURN handles a device's connectivity to its SFU.

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
  subgraph LOCAL["Publisher region"]
    P["Publisher"] -->|"Encoded layers"| L["Local SFU"]
  end
  L -->|"Subscribed layers only"| X["Regional relay"]
  subgraph REMOTE["Subscriber region"]
    R["Remote SFU"] -->|"Local stream copy"| A["Subscriber A"]
    R -->|"Local stream copy"| B["Subscriber B"]
  end
  X -->|"One inter-region copy per required layer"| R
  style LOCAL fill:#e8f0fe,stroke:#9aa0a6,color:#202124
  style REMOTE fill:#e6f4ea,stroke:#9aa0a6,color:#202124
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
classDef danger fill:#fce8e6,stroke:#9aa0a6,color:#202124;
class P,L,X,R,A,B request;
```

After a media-server failure, receivers resume restored video subscriptions from a keyframe.

Reserve failover capacity before accepting meetings at the advertised target. Reassignment advances `assignment_epoch`. Once a client has received a newer assignment, it discards older assignment responses; media servers reject commands carrying old assignment or connection versions. These checks prevent delayed control messages from overriding newer session state. Data-residency constraints can override nearest-region placement; expose that policy to the participant.

### How does end-to-end encryption change recording and trust?

Transport encryption secures each client/server leg. End-to-end encryption additionally protects media payloads from the forwarding service.

- **Transport encryption:** Encrypt each client/server leg while trusted servers can process media. Recording and mixing are available, but the service remains inside the content trust boundary.

- **Client-managed media encryption:** Encrypt payloads with endpoint-held keys beyond transport security. Forwarders cannot read content, but key distribution, device trust and recording features require endpoint support.

- **Explicit meeting trust modes — recommended:** Choose and disclose a compatible encryption/recording mode before joining. Capabilities have a clear trust contract; mode negotiation and participant-visible changes add product and key-management work.

A recorder needs media decryption keys to save readable content. In transport-encrypted mode, a trusted server can record; in E2EE mode, recording requires an authorized participant or client that holds the keys. We choose explicit meeting modes so users can see which devices or services can access the media before joining.

In E2EE mode, clients encrypt media frames before sending them to the SFU, which uses visible routing metadata to forward them. [Secure Frame (SFrame)](https://www.rfc-editor.org/rfc/rfc9605.html) provides a standardized frame-encryption format. Authorized devices establish shared media keys through a reviewed, [authenticated group-key exchange](https://www.rfc-editor.org/rfc/rfc9420.html#section-1). The meeting service relays encrypted key-exchange messages; the media keys remain with authorized devices and are updated as membership changes.

A member who receives media keys can access that meeting's media. Membership verification, consent and client security therefore remain part of the trust model.

**Trust boundaries and recording**

In transport-encrypted mode, the SFU terminates the transport and trusted server recording can process payloads. In client-managed media encryption mode, forwarding uses routing metadata while payload decryption belongs to authorized meeting members.

```mermaid
%%{init: {'theme':'base','htmlLabels':false,'flowchart':{'htmlLabels':false},'themeVariables':{'fontFamily':'Arial, sans-serif','primaryColor':'#e8f0fe','primaryTextColor':'#202124','primaryBorderColor':'#9aa0a6','lineColor':'#5f6368','secondaryColor':'#e6f4ea','tertiaryColor':'#fef7e0','actorBkg':'#e8f0fe','actorBorder':'#9aa0a6','actorTextColor':'#202124','noteBkgColor':'#fef7e0','noteTextColor':'#202124','noteBorderColor':'#9aa0a6','signalColor':'#5f6368','signalTextColor':'#202124','labelBoxBkgColor':'#fef7e0','labelBoxBorderColor':'#9aa0a6'}}}%%
flowchart TB
  subgraph TRANSPORT["Transport encryption · service can process media"]
    T1["Sending client"] <-->|"Encrypted transport"| S["Media server (SFU)<br>can decode or record"]
    S <-->|"Encrypted transport"| T2["Receiving client"]
  end
  subgraph E2EE["End-to-end encryption · clients hold media keys"]
    E1["Authorized sending client<br>encrypts payload"] -->|"Encrypted media"| F["Media server (SFU)<br>routing metadata only"]
    F -->|"Encrypted media"| E2["Authorized receiving client<br>decrypts payload"]
  end
  style TRANSPORT fill:#fef7e0,stroke:#9aa0a6,color:#202124
  style E2EE fill:#e6f4ea,stroke:#9aa0a6,color:#202124
classDef request fill:#e8f0fe,stroke:#9aa0a6,color:#202124;
classDef data fill:#e6f4ea,stroke:#9aa0a6,color:#202124;
classDef control fill:#fef7e0,stroke:#9aa0a6,color:#202124;
classDef danger fill:#fce8e6,stroke:#9aa0a6,color:#202124;
class T1,S,T2,E1,F,E2 request;
```

Give each sender distinct media keys and an increasing frame counter; receivers reject replayed frames. A sender restarts its counter only after changing its key, keeping each encryption key/counter pair unique. After a member leaves or is removed, deliver fresh keys only to remaining authorized devices. Previously received keys or decoded media remain part of the prior trust exposure. Authenticate the participant list and host actions so signaling manipulation cannot silently add a receiver.

Display the encryption mode, recording consent and authorized recorder before joining. Verify key updates after participant removal and admission of a late-joining device against the reviewed protocol version.
