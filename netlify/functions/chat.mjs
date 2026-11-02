import catalog from "../../backend/catalog.mjs";
import { createChatHandler } from "../../backend/gemini.mjs";

export default async request => createChatHandler({
  catalog,
  revision: process.env.COMMIT_REF || "",
  apiKey: process.env.GEMINI_API_KEY?.trim(),
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  siteOrigin: process.env.URL || new URL(request.url).origin
})(request);

export const config = {
  path: "/api/chat",
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip"], action: "rate_limit" }
};
