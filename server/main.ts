import { readFileSync } from "node:fs";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { Store } from "./store.ts";

const store = new Store(process.env.DATA_DIR ?? "data/dev");
const app = new Hono();
let failWrites = false;

app.use("/api/*", async (context, next) => {
  if (failWrites && context.req.method !== "GET" && !context.req.path.startsWith("/api/_")) {
    return context.json({ error: "writes are failing on purpose" }, 500);
  }
  await next();
});

app.post("/api/_fail", async (context) => {
  failWrites = Boolean((await context.req.json()).writes);
  return context.json({ writes: failWrites });
});

app.get("/api/definitions", (context) => context.json(store.definitions()));
app.post("/api/definitions", async (context) => context.json(store.putDefinition(await context.req.json()), 201));
app.put("/api/definitions/:id", async (context) =>
  context.json(store.putDefinition({ ...(await context.req.json()), id: context.req.param("id") })),
);
app.delete("/api/definitions/:id", (context) => {
  store.deleteDefinition(context.req.param("id"));
  return context.body(null, 204);
});

app.get("/api/tasks", (context) => context.json(store.tasks(context.req.query("through") ?? today())));
app.post("/api/tasks", async (context) => context.json(store.putTask(await context.req.json()), 201));
app.put("/api/tasks/:id", async (context) =>
  context.json(store.putTask({ ...(await context.req.json()), id: context.req.param("id") })),
);
app.delete("/api/tasks/:id", (context) => {
  store.deleteTask(context.req.param("id"));
  return context.body(null, 204);
});

app.get("/api/comments", (context) => context.json(store.comments()));
app.post("/api/comments", async (context) => context.json(store.putComment(await context.req.json()), 201));
app.put("/api/comments/:id", async (context) =>
  context.json(store.putComment({ ...(await context.req.json()), id: context.req.param("id") })),
);
app.delete("/api/comments/:id", (context) => {
  store.deleteComment(context.req.param("id"));
  return context.body(null, 204);
});

app.get("/api/journal/:name", (context) => context.json(store.entries(context.req.param("name"))));
app.post("/api/journal/:name", async (context) =>
  context.json(store.putEntry({ name: context.req.param("name"), entry: await context.req.json() }), 201),
);
app.put("/api/journal/:name/:id", async (context) =>
  context.json(
    store.putEntry({
      name: context.req.param("name"),
      entry: { ...(await context.req.json()), id: context.req.param("id") },
    }),
  ),
);
app.delete("/api/journal/:name/:id", (context) => {
  store.deleteEntry({ name: context.req.param("name"), id: context.req.param("id") });
  return context.body(null, 204);
});

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "dist/client" }));
  app.get("*", (context) => context.html(readFileSync("dist/client/index.html", "utf8")));
}

function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}, data in ${process.env.DATA_DIR ?? "data/dev"}`);
