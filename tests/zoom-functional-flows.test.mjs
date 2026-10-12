import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const article = readFileSync(new URL("../_designs/system-design-video-conferencing-zoom.md", import.meta.url), "utf8");
function section(title) {
  const body = article.split(`### ${title}\n`)[1];
  assert.ok(body, `Missing ${title}`);
  return body.split(/^##?\s|^###\s/m)[0];
}
function diagram(title) {
  const source = section(title).match(/```mermaid\n([\s\S]*?)```/)?.[1];
  assert.ok(source, `${title}: explained sequence is required`);
  assert.match(source, /sequenceDiagram/);
  return source;
}

test("distinct screen, chat and recording workflows retain explained sequences", () => {
  for (const title of ["Sharing a screen", "Sending chat and reactions", "Recording a meeting"]) {
    const source = diagram(title);
    assert.match(source, /actorBkg.*#e8f0fe/);
    assert.match(source, /rect rgb\(/);
    assert.ok(section(title).split("```").at(-1).trim(), "The diagram has a prose explanation");
  }
  assert.match(section("Creating a meeting"), /POST \/v1\/meetings/);
  assert.match(section("Joining a meeting"), /participant ID.*session token.*control-connection address.*assigned media server/);
});

test("screen sharing separates publication authorization from local capture", () => {
  const flow = section("Sharing a screen");
  assert.match(flow, /browser prompts.*tab, window or screen/);
  assert.match(flow, /meeting service separately checks.*SFU enforces/);
  assert.match(flow, /Cancelling.*microphone and camera streams running/);
  assert.match(diagram("Sharing a screen"), /M-->>R: Announce track removal/);
  assert.doesNotMatch(diagram("Sharing a screen"), /M-->>R: Update.*layout/);
});

test("chat commit precedes acknowledgment and catch-up uses synchronized history", () => {
  const flow = section("Sending chat and reactions"), source = diagram("Sending chat and reactions");
  assert.ok(source.indexOf("D-->>M: Commit complete") < source.indexOf("M-->>S: Acknowledge"));
  assert.match(flow, /synchronized from stored history, separately from live notifications/);
  assert.match(source, /Request history after synchronized position/);
  assert.match(source, /ordered history and next position/);
  assert.match(flow, /Reactions share the WebSocket connection.*transient events/);
  assert.match(article, /transaction locks the meeting-local sequence counter/);
  assert.match(article, /higher sequence numbers from becoming visible before earlier messages/);
  assert.match(article, /live notifications leave that position unchanged/);
});

test("recording distinguishes saved job, active capture, finalization and output storage", () => {
  const flow = section("Recording a meeting"), source = diagram("Recording a meeting");
  for (const state of ["starting", "recording", "processing", "ready", "failed"]) assert.ok(flow.includes(`\`${state}\``));
  assert.ok(source.indexOf("Save the recording job") < source.indexOf("Return recording ID and starting"));
  assert.match(source, /Mark recording after capture starts/);
  assert.match(source, /W->>W: Assemble the saved segments\n\s*W->>O: Save the final output/);
  assert.match(flow, /download URL after checking.*access/);
  assert.match(flow, /Interrupted capture.*completed segments retained/);
});
