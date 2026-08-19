import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { api } from "./routes.ts";

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

serve(
  { fetch: app.fetch, port: port, hostname: "0.0.0.0" },
  (info) => {
    console.log(`listening on http://0.0.0.0:${info.port}`);
  },
);
