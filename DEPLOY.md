# Deploying

Push to github main. The machine polls every two minutes and runs
`scripts/deploy` from the primary checkout, which builds the client into
`dist/client`. nginx serves that directory and proxies `/api/` to Parallax on
the same machine; there is no Node process of ours in production.

Requests are same-origin. The built client calls `/api/` (`.env.production`),
nginx proxies that to `http://127.0.0.1:8787`, and the request never leaves the
machine. That matters: `parallax.smallworkshop.dev` is behind Cloudflare Access,
which answers an unauthenticated request with 401 and a CORS preflight with 403
before Flask runs. A browser calling it directly cannot get past that, so the
app talks to Parallax over localhost instead and needs no CORS at all.

nginx and the proxy live in `dotfiles/machines/mac-intel-server.nix`, on
127.0.0.1:8791, and need `nix-rebuild`. cloudflared routes
`todo.smallworkshop.dev` there; its config is `~/.cloudflared/config.yml`,
outside the repo.

Logs: `/tmp/deploy-todo.stdout.log`, `/tmp/nginx.error.log`.

What counts as deployed is the sha in `dist/deployed-sha`, written only once the
build has succeeded. A deploy that dies part way leaves the checkout on the new
commit but the stamp on the old one, so the next poll tries again instead of
seeing a moved ref and calling it done.

To recover from a failed deploy, fix main and push again. Because nginx serves
files rather than running the app, the last good build stays up while a broken
one fails to build.
