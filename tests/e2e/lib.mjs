// Serves dist/ under a nested path, like an IPFS gateway, so a broken relative asset URL fails here too.
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

export const pw = await import("playwright");

export const SHOTS = "test/scratch/shots";
await mkdir(SHOTS, { recursive: true });

const PREFIX = "/ipfs/game/";
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

export async function serve() {
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (!pathname.startsWith(PREFIX)) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, pathname.slice(PREFIX.length) || "index.html");
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(file);
      res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { server, url: `http://127.0.0.1:${server.address().port}${PREFIX}` };
}
