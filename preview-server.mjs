import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".pdf": "application/pdf",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(
      root,
      "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (
      !file.startsWith(root + path.sep) ||
      path
        .relative(root, file)
        .split(path.sep)
        .some((p) => p.startsWith("."))
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!(await stat(file)).isFile()) throw Error();
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.on("error", (error) => {
  if (error.code === "EADDRINUSE")
    console.log(
      "Port 4173 is already in use. If COMMON is open, visit http://127.0.0.1:4173. Otherwise close the other server and try again.",
    );
  else console.error(error.message);
  process.exitCode = 1;
});
server.listen(4173, "127.0.0.1", () =>
  console.log(
    "COMMON is ready: http://127.0.0.1:4173\nKeep this window open. Press Ctrl+C to stop.",
  ),
);
