import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { shiftDate } from "@shared/format.ts";

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

app.onError((error, context) => context.json({ error: error.message }, error.message.startsWith("no ") ? 404 : 400));

app.post("/api/_fail", async (context) => {
  failWrites = Boolean((await context.req.json()).writes);
  return context.json({ writes: failWrites });
});

app.get("/api/schedules", (context) => context.json(store.schedules()));
app.post("/api/schedules", async (context) => context.json(store.putSchedule({ schedule: await context.req.json(), today: today() }), 201));
app.put("/api/schedules/:id", async (context) =>
  context.json(store.putSchedule({ schedule: { ...(await context.req.json()), id: context.req.param("id") }, today: today() })),
);
app.delete("/api/schedules/:id", (context) => {
  store.deleteSchedule({ id: context.req.param("id"), today: today() });
  return context.body(null, 204);
});

app.get("/api/tasks", (context) => context.json(store.tasks({ today: today(), through: context.req.query("through") ?? null })));
app.get("/api/tasks/recently-deleted", (context) => {
  const requested = context.req.query("days") ?? "7";
  if (!/^\d+$/.test(requested) || Number(requested) < 1) {
    return context.json({ error: `\`days\` must be a positive integer, got '${requested}'` }, 400);
  }
  return context.json(store.deletedTasks({ since: shiftDate({ key: today(), days: -Number(requested) }) }));
});
app.post("/api/tasks", async (context) => context.json(store.putTask(await context.req.json()), 201));
app.put("/api/tasks/:id", async (context) =>
  context.json(store.putTask({ ...(await context.req.json()), id: context.req.param("id") })),
);
app.delete("/api/tasks/:id", (context) => {
  store.deleteTask(context.req.param("id"));
  return context.body(null, 204);
});

app.get("/api/tasks/:id/comments", (context) => context.json(store.taskComments(context.req.param("id"))));
app.post("/api/tasks/:id/comments", async (context) =>
  context.json(store.createComment({ taskId: context.req.param("id"), comment: await context.req.json() }), 201),
);
app.put("/api/comments/:id", async (context) => context.json(store.updateComment({ id: context.req.param("id"), comment: await context.req.json() })));
app.delete("/api/comments/:id", (context) => {
  store.deleteComment(context.req.param("id"));
  return context.body(null, 204);
});

app.get("/api/:name{journal|notebook}", (context) => context.json(store.entries(context.req.param("name"))));
app.post("/api/:name{journal|notebook}", async (context) =>
  context.json(store.putEntry({ name: context.req.param("name"), entry: await context.req.json() }), 201),
);
app.put("/api/:name{journal|notebook}/:at", async (context) =>
  context.json(
    store.putEntry({
      name: context.req.param("name"),
      entry: { ...(await context.req.json()), at: context.req.param("at") },
    }),
  ),
);
app.delete("/api/:name{journal|notebook}/:at", (context) => {
  store.deleteEntry({ name: context.req.param("name"), at: context.req.param("at") });
  return context.body(null, 204);
});

function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port });
console.log(`stand-in listening on http://localhost:${port}, data in ${process.env.DATA_DIR ?? "data/dev"}`);
