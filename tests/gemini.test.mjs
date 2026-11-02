import test from "node:test";
import assert from "node:assert/strict";
import { createChatHandler } from "../backend/gemini.mjs";

const origin = "https://garikotanishant.github.io";
const catalog = [{ id: "library", name: "Suwanee Library", description: "Books and learning", category: "Community Life" }];
const request = (body, headers = {}) => new Request("https://example.netlify.app/api/chat", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

test("missing secret is reported without returning configuration", async () => {
  const handle = createChatHandler({ catalog });
  const health = await handle(new Request("https://example.netlify.app/api/chat"));
  assert.deepEqual(await health.json(), { configured: false, provider: null });
  assert.equal((await handle(request({ message: "library" }))).status, 503);
});

test("blocks unrelated origins and invalid messages before contacting Gemini", async () => {
  const handle = createChatHandler({ catalog, apiKey: "test-secret", fetchImpl: () => { throw new Error("must not call provider"); } });
  assert.equal((await handle(request({ message: "hi" }, { Origin: "https://unrelated.example" }))).status, 403);
  assert.equal((await handle(request({ message: "x".repeat(1201) }))).status, 400);
  assert.equal((await handle(request({ message: 12 }))).status, 400);
});

test("key stays in the server header and only real resource IDs are returned", async () => {
  const handle = createChatHandler({ catalog, apiKey: "test-secret", fetchImpl: async (url, options) => {
    assert.ok(!url.includes("test-secret"));
    assert.equal(options.headers["x-goog-api-key"], "test-secret");
    const payload = JSON.parse(options.body);
    assert.ok(payload.systemInstruction.parts[0].text.includes("Suwanee Library"));
    assert.ok(!options.body.includes("test-secret"));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Try the library.", resourceIds: ["library", "made-up-place", "library"] }) }] } }] });
  } });
  const response = await handle(request({ message: "Where is the library?" }));
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(await response.json(), { answer: "Try the library.", resourceIds: ["library"] });
});

test("quota and provider errors do not leak response text or keys", async () => {
  for (const status of [429, 403, 500]) {
    const handle = createChatHandler({ catalog, apiKey: "test-secret", fetchImpl: async () => new Response("test-secret provider debug", { status }) });
    const response = await handle(request({ message: "library" }));
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.ok(!(await response.text()).includes("test-secret"));
  }
});

test("model discovery returns only the free-model allowlist", async () => {
  const handle = createChatHandler({ catalog, apiKey: "test-secret", fetchImpl: async url => url.endsWith("/models")
    ? Response.json({ models: [{ name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] }, { name: "models/some-paid-model", supportedGenerationMethods: ["generateContent"] }] })
    : Response.json({ error: {} }, { status: 404 }) });
  assert.deepEqual((await (await handle(request({ message: "library" }))).json()).availableModels, ["gemini-3.1-flash-lite"]);
});

test("books finds the library even when many other records share the city name", async () => {
  const records = Array.from({ length: 30 }, (_, i) => ({ id: "school-" + i, name: "Suwanee School " + i, description: "Education in Suwanee", tags: [] }));
  records.push({ id: "library", name: "Suwanee Branch Library", description: "Book collections and study rooms", tags: ["reading"] });
  const handle = createChatHandler({ catalog: records, apiKey: "test-secret", fetchImpl: async (_url, options) => {
    const context = JSON.parse(options.body).systemInstruction.parts[0].text;
    assert.ok(context.includes("Suwanee Branch Library"));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Try the library.", resourceIds: ["library"] }) }] } }] });
  } });
  assert.equal((await handle(request({ message: "Where can I find books in Suwanee?" }))).status, 200);
});

test("Flash-Lite uses minimal thinking with enough room for structured output", async () => {
  const handle = createChatHandler({ catalog, apiKey: "test-secret", fetchImpl: async (_url, options) => {
    const config = JSON.parse(options.body).generationConfig;
    assert.equal(config.temperature, undefined);
    assert.equal(config.thinkingConfig.thinkingLevel, "MINIMAL");
    assert.ok(config.maxOutputTokens >= 1200);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"answer":"Try the library.","resourceIds":[]}' }] } }] });
  } });
  assert.equal((await handle(request({ message: "books" }))).status, 200);
});

test("incomplete output and provider timeouts have safe, distinct errors", async () => {
  for (const [fetchImpl, expected] of [
    [async () => Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"answer":' }] } }] }), "answer_incomplete"],
    [async () => Response.json({ candidates: [{ content: { parts: [{ text: "not JSON" }] } }] }), "invalid_provider_response"],
    [async () => { throw new DOMException("test-secret", "TimeoutError"); }, "provider_timeout"]
  ]) {
    const handle = createChatHandler({ catalog, apiKey: "test-secret", fetchImpl });
    const result = await (await handle(request({ message: "books" }))).json();
    assert.deepEqual(result, { error: expected });
  }
});
