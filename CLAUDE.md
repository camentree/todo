# todo

## Code style checks

Reuse
- [ ] No new component, hook or CSS class where an existing one does the job
- [ ] Two near-identical things become identical, not one component with a variant prop
- [ ] The diff changes what is there rather than adding beside it

Naming
- [ ] Every name says what the thing is in domain words (attributes, onCommit, useMoveTask)
- [ ] No abbreviations
- [ ] A hook or module named after a thing is owned by that thing

Ownership and simplicity
- [ ] Behaviour lives on its owner
- [ ] No hook that wraps a hook, no use* where a plain function would do, no concept that disappears when you say "why not just"
- [ ] Use a library before writing your own

Code shape
- [ ] No comments, on new code
- [ ] More than one parameter means a destructured object; exports are export function
- [ ] Explicit .ts/.tsx extensions, @shared/ alias, import type kept separate

UI
- [ ] Phone is the base; desktop is added with min-width and hover queries and changes nothing on the phone
- [ ] Same things look the same everywhere: control placement, sizes, line colours, swipe threshold
- [ ] Touch targets survive a thumb; anything that appears moves slowly

Tests and process
- [ ] Tests where being wrong would be silent (parser, recurrence, grouping, search), not layout

## Testing

Check UI changes in a browser against a seeded slice (`README.md`), never the
live site. Re-seed before each run so every check starts from the same data:
`cd dev-api && npx tsx seed.ts ../data/<slice>`, then restart `bin/dev <slice>`.

### Chrome

Drive Chrome with Claude in Chrome, the extension that acts in Camen's real
Chrome (`mcp__claude-in-chrome__*` tools). If the extension is not reachable,
Chrome is probably closed: start it with `open -a "Google Chrome"` and try
again. If it is still not connected after that, say so rather than retrying.

- Open a new tab on the LAN URL `bin/dev` prints and close it when done. The
  real Chrome is signed in to the live site, so never test against it.
- Drag in small steps, since the list reads pointer moves, and keep drop
  targets away from the top and bottom 120px, where the list scrolls itself.
- Read results back from the stand-in (`GET /api/tasks`) rather than from the
  page alone, and take screenshots to look at layout.
- Avoid clicking anything that raises a browser dialog: it blocks the
  extension until it is dismissed by hand.

### iOS Simulator

Xcode 27 replaced Simulator.app with Device Hub. `open -a Simulator` fails;
open the window with `open -b com.apple.dt.Devices`.

```
xcrun simctl boot "iPhone 18 Pro"
xcrun simctl openurl booted http://<lan>:<vite-port>/
xcrun simctl io booted screenshot <file>
```

`simctl` and `devicectl` cannot tap, drag or type, so the simulator is for
screenshots of layout only. Gestures and typing get checked on Camen's phone.

`safaridriver` would drive Safari in the simulator, but on this machine
(Xcode 27) it finds no simulator hosts: a session with
`{"platformName": "iOS", "safari:useSimulator": true}` answers "Could not find
any session hosts", on both the iOS 27.0 and iOS 26.5 runtimes, while desktop
Safari sessions work. `sudo safaridriver --enable` has already been run. Retry
after an Xcode or macOS update rather than repeating the same setup.

## Deploying

Push to main. A launchd agent polls and deploys from the primary checkout on
this machine, but only when that checkout is on a clean main — so a stray
uncommitted change there quietly stops every deploy.

That checkout is also where the running server lives. Do not pull in it by hand:
the deploy only restarts the server on the path where it moves the ref itself,
so a manual pull leaves the process running the old code with nothing reporting
a problem. Work in a worktree and let the agent do the deploy.

`DEPLOY.md` has the rest, including the log locations and how to recover from a
failed deploy.
