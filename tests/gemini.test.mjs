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
