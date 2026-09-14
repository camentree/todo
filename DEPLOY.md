# Deploying

- push to github main
- the machine polls every two minutes and runs `scripts/deploy` from the primary checkout
- the deploy builds the client and restarts the `org.nixos.todo` launchd agent, which runs `npm start`
- logs: `/tmp/todo.stdout.log`, `/tmp/todo.stderr.log`, `/tmp/deploy-todo.stdout.log`
- data lives in `data/parallax.json` next to the checkout (`DATA_FILE` overrides it); it is not in git

To recover from a failed deploy, fix main and push again. If the server will not
start, `launchctl kickstart -k gui/$UID/org.nixos.todo` after checking the
stderr log.
