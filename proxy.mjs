import http from "node:http";
import https from "node:https";

const PORT = 9876;
const TARGET = "api.anthropic.com";

http
  .createServer((req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
      });
      return res.end();
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
          "x-api-key": req.headers["x-api-key"] || "",
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
