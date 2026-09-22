# The stand-in API

`main.ts` stands in for Parallax's HTTP server for dev and testing. It tracks
Parallax's own server, `src/parallax/servers/http.py`, and the features behind
it, `src/parallax/features/tasks.py`, `journal.py` and `notebook.py`, on
`camentree/parallax` main. When the contract there changes, change it here.

It imports nothing from `../src`. The wire model below is written out twice on
purpose: a double that shares its types with the client cannot catch contract
drift.

It keeps everything in one directory, `DATA_DIR`: `parallax.json` (schedules,
flat task rows with `parentId` and `scheduleId`, comments) and `journal.md` and
`notebook.md`.

## The wire model

`model.ts`: camelCase fields, `title`/`type`/`sortOrder`, the type one of
`boolean`, `timer_seconds`, `count`, `amount`, `text`, progress in flat fields
(`target` required and non-negative for the numeric types and null for
`boolean`/`text`, `numericalValue` for numeric progress, `stringValue` for
text, `restSeconds`), `finalizedAt` and `isSkipped` for state (done means
finalized and not skipped), a read-only `createdAt` (UTC, ignored on writes),
and structured recurrence on the schedule (`frequency`, `repeatEvery`,
`weekdays` with Monday as 0, `dayOfMonth`, `startsOn`, `endedOn`). A schedule
carries its subtask template as `subtasks` (`title`, `type`, `target`,
`restSeconds`, `note`, `sortOrder`). Shape violations are 400 `{error}`.

Entries split on H2. An entry is a section title, an `at` timestamp, a body and
metadata; the section title is always the `at` timestamp written
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
camelCase: `displayTitle`, `tags`, `author`. `tags` may repeat or carry a comma
list and reads the same either way; it is written as one comma list on disk and
read as a list of strings.

An entry has no id: `at` identifies it, so two entries never share a timestamp.
The display title is what the entry shows anywhere it has one, and the section
title otherwise.

## Endpoints

All JSON, all under `/api`.

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
- `GET /api/tasks/recently-deleted?days=N`.
- `GET /api/tasks/:id/comments`, `POST /api/tasks/:id/comments`,
  `PUT /api/comments/:id`, `DELETE /api/comments/:id`. Comments hang off one
  task row; reading a schedule instance's comments aggregates across every
  instance of that schedule.
- `GET /api/journal` and `GET /api/notebook`, `POST` the same paths,
  `PUT /api/journal/:at`, `DELETE /api/journal/:at` (and `notebook` alike),
  `:at` url-encoded.

## Not part of the contract

`POST /_dev/fail {"writes": true}` makes every later write return 500 until set
back to false. Use it to check the client reverts and shows the error. It sits
outside `/api` because Parallax does not have it.

CORS allows any `localhost`, `127.0.0.1` or `192.168.x.x` origin, so the client
reaches it from the browser and the simulator the same way it reaches Parallax.
