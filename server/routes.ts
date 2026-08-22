import { Hono } from "hono";

import * as comments from "./operations/comments.ts";
import * as events from "./operations/events.ts";
import * as lists from "./operations/lists.ts";
import * as recurring from "./operations/recurring.ts";
import * as tasks from "./operations/tasks.ts";
import { TASK_STATES } from "@shared/states.ts";
import type { TaskState } from "@shared/states.ts";

export const api = new Hono();

function numberParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${value} is not a number`);
  }
  return parsed;
}

function taskState(value: unknown): TaskState {
  const found = TASK_STATES.find((state) => state === value);
  if (!found) {
    throw new Error(`${value} is not a task state`);
  }
  return found;
}

api.get("/lists", async (context) => {
  return context.json(await lists.all());
});

api.get("/stages", async (context) => {
  return context.json(await lists.stages());
});

api.get("/tags", async (context) => {
  return context.json(
    await lists.tagsOf(context.req.query("list") ?? null),
  );
});

api.get("/who", async (context) => {
  return context.json(
    await lists.knownWho(context.req.query("list") ?? null),
  );
});

api.get("/tasks", async (context) => {
  await recurring.generateDue();
  return context.json(
    await tasks.query({ since: context.req.query("since") ?? null }),
  );
});

api.get("/tasks/:id", async (context) => {
  const found = await tasks.byId(
    numberParam(context.req.param("id")),
  );
  if (!found) {
    return context.json({ error: "no such task" }, 404);
  }
  return context.json(found);
});

api.post("/tasks", async (context) => {
  const body = await context.req.json();
  return context.json(
    await tasks.create({
      list: body.list,
      title: body.title,
      parentId: body.parentId,
      note: body.note,
      stage: body.stage,
      tags: body.tags,
      who: body.who,
      dueDate: body.dueDate,
      dueTime: body.dueTime,
      schedule: body.schedule,
      state: body.state ? taskState(body.state) : undefined,
      archivedAt: body.archivedAt,
    }),
  );
});

api.patch("/tasks/:id", async (context) => {
  const body = await context.req.json();
  return context.json(
    await tasks.update(numberParam(context.req.param("id")), body),
  );
});

api.delete("/tasks/:id", async (context) => {
  return context.json({
    removed: await tasks.remove(numberParam(context.req.param("id"))),
  });
});

api.post("/tasks/:id/state", async (context) => {
  const body = await context.req.json();
  return context.json(
    await tasks.setState(
      numberParam(context.req.param("id")),
      taskState(body.state),
    ),
  );
});

api.post("/tasks/:id/hide", async (context) => {
  return context.json(
    await tasks.hide(numberParam(context.req.param("id"))),
  );
});

api.post("/tasks/:id/unhide", async (context) => {
  return context.json(
    await tasks.unhide(numberParam(context.req.param("id"))),
  );
});

api.post("/tasks/:id/defer", async (context) => {
  return context.json(
    await tasks.deferByOneDay(numberParam(context.req.param("id"))),
  );
});

api.get("/tasks/:id/comments", async (context) => {
  return context.json(
    await comments.forTask(numberParam(context.req.param("id"))),
  );
});

api.post("/tasks/:id/comments", async (context) => {
  const body = await context.req.json();
  return context.json(
    await comments.add({
      taskId: numberParam(context.req.param("id")),
      body: body.body,
      author: body.author,
    }),
  );
});

api.post("/tasks/:id/comments/seen", async (context) => {
  await comments.markSeen(numberParam(context.req.param("id")));
  return context.json({ ok: true });
});

api.post("/comments/:id/seen", async (context) => {
  await comments.markOneSeen(numberParam(context.req.param("id")));
  return context.json({ ok: true });
});

api.post("/tasks/archive", async (context) => {
  const body = await context.req.json();
  return context.json(await tasks.archive(body.ids));
});

api.post("/tasks/unarchive", async (context) => {
  const body = await context.req.json();
  return context.json(await tasks.unarchive(body.ids));
});

api.post("/tasks/reorder", async (context) => {
  const body = await context.req.json();
  return context.json(await tasks.reorder(body.ids));
});

api.get("/events/unseen", async (context) => {
  return context.json(await events.unseen());
});

api.post("/events/seen", async (context) => {
  await events.markAllSeen();
  return context.json({ ok: true });
});

api.post("/events/:id/seen", async (context) => {
  await events.markSeen(numberParam(context.req.param("id")));
  return context.json({ ok: true });
});
