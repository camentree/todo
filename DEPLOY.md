# Deploying

Push to github main. The machine polls every two minutes, runs `scripts/deploy`
from the primary checkout, builds the client and restarts the `org.nixos.todo`
launchd agent, which runs `npm start`.

The server needs `API_URL` in its environment (the launchd agent's, set in
dotfiles): it proxies `/api` there and serves the built client. All data lives
behind that API.

Logs: `/tmp/todo.stdout.log`, `/tmp/todo.stderr.log`,
`/tmp/deploy-todo.stdout.log`.

To recover from a failed deploy, fix main and push again. If the server will
not start, `launchctl kickstart -k gui/$UID/org.nixos.todo` after checking the
stderr log.
