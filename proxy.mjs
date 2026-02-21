import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";

const PORT = 9876;
const TARGET = "api.anthropic.com";

// read .env
const env = {};
try {
  const raw = readFileSync(".env", "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) env[match[1]] = match[2].trim();
  }
} catch (_) {
  console.error("Warning: .env file not found");
}

const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY || "";
const SONIOX_KEY = env.SONIOX_API_KEY || "";

http
  .createServer((req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
      });
      return res.end();
    }

    // serve Soniox key to browser
    if (req.url === "/config" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(JSON.stringify({ sonioxKey: SONIOX_KEY }));
    }

    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const opts = {
        hostname: TARGET,
        path: req.url,
        method: req.method,
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": req.headers["anthropic-version"] || "2023-06-01",
        },
      };

      const proxy = https.request(opts, (upstream) => {
        res.writeHead(upstream.statusCode, {
          ...upstream.headers,
          "Access-Control-Allow-Origin": "*",
        });
        upstream.pipe(res);
      });

      proxy.on("error", (e) => {
        res.writeHead(502, { "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: e.message }));
      });

      proxy.end(body);
    });
  })
  .listen(PORT, () => console.log(`CORS proxy → https://${TARGET} on :${PORT}`));
