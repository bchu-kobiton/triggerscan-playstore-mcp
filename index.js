import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

function createServer() {
  const server = new McpServer({
    name: "play-store",
    version: "1.0.0"
  });

  server.registerTool(
    "play_store_app_version",
    {
      title: "Play Store App Version",
      description: "Get the current version, release date, and description snippet for a Play Store app by package ID",
      inputSchema: {
        package_id: z.string()
      }
    },
    async ({ package_id }) => {
      const url = `https://play.google.com/store/apps/details?id=${package_id}&hl=en&gl=US`;
      const html = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }
      }).then(r => r.text());

      const $ = cheerio.load(html);
      const jsonLdText = $('script[type="application/ld+json"]').first().text();
      const jsonLd = jsonLdText ? JSON.parse(jsonLdText) : {};

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            package_id,
            version: jsonLd.softwareVersion ?? null,
            date_published: jsonLd.datePublished ?? null,
            description_snippet: (jsonLd.description ?? "").slice(0, 300),
            url
          })
        }]
      };
    }
  );

  server.registerTool(
    "play_store_app_rating",
    {
      title: "Play Store App Rating",
      description: "Get current star rating and review count for a Play Store app",
      inputSchema: {
        package_id: z.string()
      }
    },
    async ({ package_id }) => {
      const url = `https://play.google.com/store/apps/details?id=${package_id}&hl=en&gl=US`;
      const html = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }
      }).then(r => r.text());

      const $ = cheerio.load(html);
      const jsonLdText = $('script[type="application/ld+json"]').first().text();
      const jsonLd = jsonLdText ? JSON.parse(jsonLdText) : {};

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            package_id,
            rating: jsonLd.aggregateRating?.ratingValue ?? null,
            rating_count: jsonLd.aggregateRating?.ratingCount ?? null,
            url
          })
        }]
      };
    }
  );

  return server;
}

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/", (req, res) => {
  res.send("Play Store MCP server is running. Use /mcp for MCP requests.");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Play Store MCP server listening on port ${port}`);
});
