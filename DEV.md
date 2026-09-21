# Running and resetting

## The stand-in API

`server/standin.ts` stands in for Parallax's HTTP server for dev and testing;
it serves the same contract Parallax does (the `worktree-todo-api` branch of
the parallax repo is the reference). It keeps everything in one directory,
`DATA_DIR`: `parallax.json` (schedules, flat task rows with `parentId` and
`scheduleId`, comments) and `journal.md` and `notebook.md`. The wire model is
`shared/model.ts`: camelCase fields, `title`/`type`/`sortOrder`, the type one
of `boolean`, `timer_seconds`, `count`, `amount`, `text`, progress in flat
fields (`target` required and non-negative for the numeric types and null for
`boolean`/`text`, `numericalValue` for numeric progress, `stringValue` for
text, `restSeconds`), `finalizedAt` and `isSkipped` for state (done means
finalized and not skipped), a read-only `createdAt` (UTC, ignored on writes),
and structured recurrence on the schedule (`frequency`, `repeatEvery`,
`weekdays` with Monday as 0, `dayOfMonth`, `startsOn`, `endedOn`). A schedule
carries its subtask template as `subtasks` (`title`, `type`, `target`,
`restSeconds`, `note`, `sortOrder`). Shape violations are 400 `{error}`. The
composer's `#every` token compiles to the rule through `ruleFromToken` and
back through `everyToken` in `shared/grammar.ts`.

Entries split on H2. An entry is a section title, an `at` timestamp, a body
and metadata; the section title is always the `at` timestamp written
`YYYY-MM-DDTHH:MM:SS`, and so is the H2. Under it comes a blank line, the
metadata fenced between `---` lines as `key: value`, a blank line, then the
body:

```
## 2026-09-16T21:05:00

---
display_title: what I read this week
tags: books
---

body…
```

The fence is the only place metadata is read from — bare `key: value` lines
outside it are body text, which is how Parallax reads them too. Its three keys
are `display_title`, `tags` and `author`, each written only when set, and the
fence is left out altogether when none are. On the wire those same three are
camelCase: `displayTitle`, `tags`, `author`. `tags` may repeat or carry a
comma list and reads the same either way; it is written as one comma list on
disk and read as a list of strings.

An entry has no id: `at` identifies it, so two entries never share a
timestamp. The display title is what the entry shows anywhere it has one, and
the section title otherwise; editing the H2 line in the editor writes the
display title, and typing it back to the timestamp clears it.

Endpoints, all JSON:

- `GET /api/schedules`, `POST /api/schedules`, `PUT /api/schedules/:id`,
  `DELETE /api/schedules/:id`. Writing a schedule drops its future instances
  and re-creates them; deleting one cascades to instances from today on.
- `GET /api/tasks` returns top-level tasks only, backlog rows included (their
  `dueDate` is null), each with its `subtasks` (full task objects with their
  own ids) and `comments` nested. It instantiates due schedules for today and
  the coming six days first, once per date; `?through=YYYY-MM-DD` instantiates
  up to a different day. `POST /api/tasks`, `PUT /api/tasks/:id`,
  `DELETE /api/tasks/:id`. A write that includes a `subtasks` array replaces
  the children: rows whose ids are absent are deleted, the rest are upserted
  and re-parented.
- `GET /api/tasks/:id/comments`, `POST /api/tasks/:id/comments`,
  `PUT /api/comments/:id`, `DELETE /api/comments/:id`. Comments hang off one
  task row; reading a schedule instance's comments aggregates across every
  instance of that schedule.
- `GET /api/journal` and `GET /api/notebook`, `POST` the same paths,
  `PUT /api/journal/:at`, `DELETE /api/journal/:at` (and `notebook` alike),
  `:at` url-encoded.
- `POST /api/_fail {"writes": true}` makes every later write return 500 until
  set back to false. Use it to check the client reverts and shows the error.
  Stand-in only; Parallax does not have it.

The client loads schedules, tasks and both journals once at start and holds
them in memory; comments arrive embedded in their tasks. A write changes
memory first, then goes to the API; if the API fails the change is reverted
in memory and an error sprite shows the message.

## Running

Run `npm install` first in a fresh checkout or worktree, and again whenever
`package.json` has changed since the last one: Vite fails at request time with
`Failed to resolve import "<package>"` rather than at startup, so a missing
dependency looks like a broken page instead of a failed launch. If Vite was
already running during the install, restart it after
`rm -rf node_modules/.vite`: its pre-bundled dependency cache keeps the old
hashes, the chunks come back 503 and the page stays blank with an empty console.

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
some days missed and some counts left short, exercise definitions with subtasks,
an overdue one-off, one due today, three due this week, a backlog across
personal, garden and programming, comments on habits, one unseen comment from
an agent on a backlog task, two weeks of journal entries across four tags, and
eight notes across five tags, some of both left at their auto-generated title
and some renamed. Re-run it any time to start over; it is deterministic.

The stand-in reads the directory once at startup and keeps it in memory, so
restart `npm run dev` after seeding or the app keeps showing the old data.

## Isolation

Anything that runs in parallel gets its own `DATA_DIR` and its own `PORT`
pair (server port and Vite port), for example `data/slice2` on 8796 with Vite
on 5174 (`vite --host --port 5174`). Never point two servers at one
directory. `data/` is ignored by git.

After any test that changed data, re-seed before the next check so every
criterion is judged against the same starting state.
