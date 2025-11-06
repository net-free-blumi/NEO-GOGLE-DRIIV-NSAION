import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

app.get("/api/stream/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const authHeader = req.headers.authorization;
    const tokenFromQuery = (req.query.token as string | undefined) || undefined;
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader
      : tokenFromQuery
      ? `Bearer ${tokenFromQuery}`
      : undefined;

    if (!bearer) {
      res.status(401).json({ error: "Missing access token" });
      return;
    }

    const range = req.headers.range as string | undefined;
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media`;

    const headers: Record<string, string> = { Authorization: bearer };
    if (range) headers.Range = String(range);

    const driveRes = await fetch(driveUrl, { headers });

    res.status(driveRes.status);

    const passthroughHeaders = [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
      "cache-control",
      "etag",
      "last-modified",
    ];
    for (const [k, v] of driveRes.headers.entries()) {
      if (passthroughHeaders.includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    if ((driveRes as any).body) {
      (driveRes.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Proxy error", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Drive proxy running on http://0.0.0.0:${port}`);
});



