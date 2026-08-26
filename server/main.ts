import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import * as recurring from "./operations/recurring.ts";
import { api } from "./routes.ts";

const ROLL_OVER_MINUTES = 10;

const app = new Hono();

app.onError((error, context) => {
  console.error(error);
  return context.json({ error: error.message }, 500);
});

app.route("/api", api);

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("/*", serveStatic({ path: "./dist/client/index.html" }));
}

const port = Number.parseInt(process.env.PORT ?? "8790", 10);

async function rollOver(): Promise<void> {
  try {
    await recurring.rollOver();
  } catch (error) {
    console.error(error);
  }
}

serve(
  { fetch: app.fetch, port: port, hostname: "0.0.0.0" },
  (info) => {
    console.log(`listening on http://0.0.0.0:${info.port}`);
  },
);

void rollOver();
setInterval(() => void rollOver(), ROLL_OVER_MINUTES * 60_000);
