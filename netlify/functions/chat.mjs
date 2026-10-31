import catalog from "../../backend/catalog.mjs";
import { createChatHandler } from "../../backend/gemini.mjs";

export default async request => createChatHandler({
  catalog,
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  siteOrigin: process.env.URL || new URL(request.url).origin
})(request);

export const config = {
  path: "/api/chat",
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip"], action: "rate_limit" }
};
