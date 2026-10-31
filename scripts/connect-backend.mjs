import { readFile, writeFile } from "node:fs/promises";
const url = new URL(process.argv[2] || "");
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Use the HTTPS address of your Netlify project, without a key or query parameters.");
const endpoint = url.origin + "/api/chat";
await writeFile(new URL("../assistant-config.js", import.meta.url), "// Public backend address only. The Gemini key stays in Netlify.\nwindow.COMMON_ASSISTANT_CONFIG = " + JSON.stringify({ endpoint }) + ";\n");
for (const page of ["index.html", "directory.html", "about.html", "contact.html", "submit-resource.html"]) {
  const file = new URL("../" + page, import.meta.url);
  const html = await readFile(file, "utf8");
  await writeFile(file, html.replace(/assistant-config\.js(?:\?[^"\s]*)?/g, "assistant-config.js?v=" + Date.now()));
}
console.log("Connected public assistant URL: " + endpoint);
