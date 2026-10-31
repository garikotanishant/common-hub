import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
vm.runInNewContext(await readFile(path.join(root, "resources-data.js"), "utf8"), sandbox, { timeout: 1000 });
const catalog = sandbox.window.COMMON_RESOURCE_RECORDS.map(r => Object.fromEntries(
  ["id", "name", "category", "description", "utility", "address", "phone", "hours", "audience", "requirements", "sourceUrl", "verificationNotes", "tags"].map(key => [key, r[key]])
));
await mkdir(path.join(root, "backend"), { recursive: true });
await writeFile(path.join(root, "backend/catalog.mjs"), "export default " + JSON.stringify(catalog) + ";\n");
await mkdir(path.join(root, "public"), { recursive: true });
const files = ["index.html", "directory.html", "about.html", "contact.html", "submit-resource.html", "common_suwanee_gwinnett_community_resource_directory.html", "style.css", "script.js", "resources-data.js", "earth.js", "submit-resource.js", "site-assistant.js", "assistant.css", "assistant-config.js", "assets", "Website Info_Data"];
for (const name of files) await cp(path.join(root, name), path.join(root, "public", name), { recursive: true });
console.log(`Built static website and private catalog with ${catalog.length} resources.`);
