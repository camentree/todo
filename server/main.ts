import { readFileSync } from "node:fs";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { Store } from "./store.ts";

const store = new Store(process.env.DATA_FILE ?? "data/parallax.json");
const app = new Hono();

app.get("/api/day/:date", (context) => context.json(store.day(context.req.param("date"))));

app.put("/api/day/:date/tasks", async (context) => {
  store.putTasks({ date: context.req.param("date"), tasks: await context.req.json() });
  return context.body(null, 204);
});

app.put("/api/definitions", async (context) => {
  store.putDefinitions(await context.req.json());
  return context.body(null, 204);
});

app.post("/api/journal", async (context) => {
  store.addEntry(await context.req.json());
  return context.body(null, 204);
});

app.put("/api/journal/:id", async (context) => {
  store.updateEntry({ ...(await context.req.json()), id: context.req.param("id") });
  return context.body(null, 204);
});

app.delete("/api/journal/:id", (context) => {
  store.deleteEntry(context.req.param("id"));
  return context.body(null, 204);
});

app.post("/api/comments", async (context) => {
  store.addComment(await context.req.json());
  return context.body(null, 204);
});

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "dist/client" }));
  app.get("*", (context) => context.html(readFileSync("dist/client/index.html", "utf8")));
}

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}`);
