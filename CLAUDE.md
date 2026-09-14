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
