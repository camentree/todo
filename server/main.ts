import { readFileSync } from "node:fs";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { proxy } from "hono/proxy";

const apiUrl = process.env.API_URL;
if (!apiUrl) throw new Error("API_URL is not set");

const app = new Hono();

app.all("/api/*", (context) => {
  const { pathname, search } = new URL(context.req.url);
  return proxy(new URL(pathname + search, apiUrl), { ...context.req });
});

app.use("/*", serveStatic({ root: "dist/client" }));
app.get("*", (context) => context.html(readFileSync("dist/client/index.html", "utf8")));

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}, proxying /api to ${apiUrl}`);
