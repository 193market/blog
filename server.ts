import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Check if Naver API is configured on the server
  app.get("/api/naver/status", (req, res) => {
    const isConfigured = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
    res.json({ configured: isConfigured });
  });

  // Proxy route for Naver API
  app.get("/api/naver/search/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const { query, display, sort } = req.query;
      
      const clientId = req.headers["x-naver-client-id"] || process.env.NAVER_CLIENT_ID;
      const clientSecret = req.headers["x-naver-client-secret"] || process.env.NAVER_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Naver API credentials are not configured on the server or provided in headers." });
      }

      const params = new URLSearchParams();
      if (query) params.append("query", String(query));
      if (display) params.append("display", String(display));
      if (sort) params.append("sort", String(sort));

      const targetUrl = `https://openapi.naver.com/v1/search/${type}.json?${params.toString()}`;

      const response = await fetch(targetUrl, {
        headers: {
          "X-Naver-Client-Id": clientId as string,
          "X-Naver-Client-Secret": clientSecret as string,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error) {
      console.error("Naver API proxy error:", error);
      res.status(500).json({ error: "Failed to fetch data from Naver API" });
    }
  });

  // Proxy route for autocomplete
  app.get("/api/autocomplete/:source", async (req, res) => {
    try {
      const { source } = req.params;
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      let targetUrl = "";
      if (source === "naver") {
        targetUrl = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(String(q))}&con=1&frm=nx&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`;
      } else if (source === "google") {
        targetUrl = `https://suggestqueries.google.com/complete/search?client=chrome&hl=ko&q=${encodeURIComponent(String(q))}`;
      } else {
        return res.status(400).json({ error: "Invalid source" });
      }

      const response = await fetch(targetUrl);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Autocomplete proxy error:", error);
      res.status(500).json({ error: "Failed to fetch autocomplete data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
