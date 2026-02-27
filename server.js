const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const GLYPH_FILE = path.join(ROOT, "glyphs.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const reqPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(reqPath).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function handleApi(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/glyphs") {
    fs.readFile(GLYPH_FILE, "utf8", (err, data) => {
      if (err) {
        if (err.code === "ENOENT") {
          sendJson(res, 200, { glyphs: {} });
          return;
        }

        sendJson(res, 500, { error: "Failed to read glyph file." });
        return;
      }

      try {
        const glyphs = JSON.parse(data);
        sendJson(res, 200, { glyphs });
      } catch (parseErr) {
        sendJson(res, 500, { error: "glyphs.json is invalid JSON." });
      }
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/glyphs/save") {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));

    req.on("end", () => {
      let payload;

      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch (err) {
        sendJson(res, 400, { error: "Invalid JSON payload." });
        return;
      }

      fs.writeFile(GLYPH_FILE, JSON.stringify(payload, null, 2), "utf8", (err) => {
        if (err) {
          sendJson(res, 500, { error: "Failed to write glyph file." });
          return;
        }

        sendJson(res, 200, { ok: true, path: GLYPH_FILE });
      });
    });

    req.on("error", () => {
      sendJson(res, 500, { error: "Request stream failed." });
    });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`LED DFI server running at http://localhost:${PORT}`);
});
