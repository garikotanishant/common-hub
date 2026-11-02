import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../site-assistant.js", import.meta.url), "utf8");
async function widget(t, fetchImpl) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://garikotanishant.github.io/common-hub/", runScripts: "outside-only"
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.fetch = fetchImpl;
  window.COMMON_RESOURCE_RECORDS = [];
  window.eval(script);
  await setImmediate();
  return window;
}
const get = (window, id) => window.document.getElementById(id);
function submit(window, text) {
  get(window, "assistantInput").value = text;
  get(window, "assistantForm").dispatchEvent(new window.Event("submit", { cancelable: true }));
}

test("a failed health check stays visible and a consented message can recover without reloading", async t => {
  const calls = [];
  const window = await widget(t, async (_url, options) => {
    calls.push(options);
    if (options.method !== "POST") throw new TypeError("network down");
    return Response.json({ answer: "Try Suwanee Branch Library.", resourceIds: [] });
  });
  assert.match(get(window, "assistantConnection").textContent, /Can’t reach/);
  assert.equal(get(window, "assistantConsent").hidden, false);
  assert.equal(get(window, "assistantRetry").disabled, false);
  get(window, "assistantAIConsent").checked = true;
  submit(window, "Where can I find books?");
  await setImmediate();
  assert.equal(calls.filter(c => c.method === "POST").length, 1);
  assert.match(get(window, "assistantMessages").textContent, /Try Suwanee Branch Library/);
  assert.match(get(window, "assistantMode").textContent, /Gemini ·/);
  assert.equal(get(window, "assistantRetry").hidden, true);
});

test("retry reconnects after an outage and never sends chat without consent", async t => {
  let available = false;
  let posts = 0;
  const window = await widget(t, async (_url, options) => {
    if (options.method === "POST") posts++;
    if (!available) throw new TypeError("network down");
    return Response.json({ configured: true });
  });
  available = true;
  get(window, "assistantRetry").click();
  await setImmediate();
  assert.match(get(window, "assistantMode").textContent, /Gemini ·/);
  submit(window, "How does this work?");
  await setImmediate();
  assert.equal(posts, 0);
  assert.match(get(window, "assistantMessages").textContent, /work locally/);
});

test("returning online retries health and quota failures leave the send control usable", async t => {
  let checks = 0;
  const window = await widget(t, async (_url, options) => {
    if (options.method === "POST") return Response.json({ error: "quota_exceeded" }, { status: 429 });
    checks++;
    return Response.json({ configured: true });
  });
  window.dispatchEvent(new window.Event("online"));
  await setImmediate();
  assert.equal(checks, 2);
  get(window, "assistantAIConsent").checked = true;
  submit(window, "Where can I find books?");
  await setImmediate();
  assert.match(get(window, "assistantMessages").textContent, /request limit/);
  assert.equal(window.document.querySelector("#assistantForm button").disabled, false);
});
