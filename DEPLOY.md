# Deploying

Push to github main. The machine polls every two minutes and runs
`scripts/deploy` from the primary checkout, which builds the client into
`dist/client`. nginx serves that directory; there is no Node process in
production. The built client calls `https://parallax.smallworkshop.dev/api/`
directly, from `.env.production`.

Logs: `/tmp/deploy-todo.stdout.log`.

What counts as deployed is the sha in `dist/deployed-sha`, written only once the
build has succeeded. A deploy that dies part way leaves the checkout on the new
commit but the stamp on the old one, so the next poll tries again instead of
seeing a moved ref and calling it done.

To recover from a failed deploy, fix main and push again. Because nginx serves
files rather than running the app, the last good build stays up while a broken
one fails to build.
