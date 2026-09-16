# Running and resetting

## The stand-in API

`server/main.ts` stands in for Parallax's HTTP server until Parallax has these
endpoints. It keeps everything in one directory, `DATA_DIR`: `parallax.json`
(definitions, tasks, comments) and `journal.md` and `notebook.md` (entries
split on H2, an HTML comment under each heading holds id, tags and task). The
data model is `shared/model.ts`; the client should use it and retire the
habit-app types in `shared/types.ts` as it goes.

Endpoints, all JSON:

- `GET /api/definitions`, `POST /api/definitions`, `PUT /api/definitions/:id`,
  `DELETE /api/definitions/:id`
- `GET /api/tasks` returns every task instance, backlog rows included (their
  `date` is null). It instantiates due definitions for today and the coming
  six days first, once per date. `?through=YYYY-MM-DD` instantiates up to a
  different day. `POST /api/tasks`, `PUT /api/tasks/:id`,
  `DELETE /api/tasks/:id`.
- `GET /api/comments`, `POST /api/comments`, `PUT /api/comments/:id`,
  `DELETE /api/comments/:id`.
- `GET /api/journal/:name` (`journal` or `notebook`), `POST /api/journal/:name`,
  `PUT /api/journal/:name/:id`, `DELETE /api/journal/:name/:id`.
- `POST /api/_fail {"writes": true}` makes every later write return 500 until
  set back to false. Use it to check the client reverts and shows the error.

The client loads definitions, tasks, comments and both journals once at
start and holds them in memory. A write changes memory first, then goes to
the API; if the API fails the change is reverted in memory and an error
sprite shows the message.

## Running

```
DATA_DIR=data/dev PORT=8795 npm run dev:server
PORT=8795 npm run dev:client
```

Vite proxies `/api` to `PORT`. Open the client at `http://192.168.0.168:5173`
from Chrome and the iOS Simulator; `localhost` does not reach the Chrome
extension. The simulator opens a URL with
`xcrun simctl openurl booted <url>` and screenshots with
`xcrun simctl io booted screenshot <file>`.

`.env` in this worktree sets `DATA_DIR=data/dev` and `PORT=8795`, so plain
`npm run dev` works too.

## Seeding and resetting

```
npm run seed            # writes data/dev from scratch
npm run seed -- data/x  # writes another directory
```

The seed is realistic and relative to today: three weeks of habit history with
some days missed and some counts left short, exercise definitions with parts,
an overdue one-off, one due today, three due this week, a backlog across
personal, garden and programming, comments on habits, one unseen comment from
an agent on a backlog task, two weeks of journal entries across four tags, and
eight notes across five tags, some of both left at their auto-generated title
and some renamed. Re-run it any time to start over; it is deterministic.

## Isolation

Anything that runs in parallel gets its own `DATA_DIR` and its own `PORT`
pair (server port and Vite port), for example `data/slice2` on 8796 with Vite
on 5174 (`vite --host --port 5174`). Never point two servers at one
directory. `data/` is ignored by git.

After any test that changed data, re-seed before the next check so every
criterion is judged against the same starting state.
