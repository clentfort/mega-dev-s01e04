# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

The status board links each night to `/digest/YYYY-MM-DD`. Agents can read the same digest
at `/api/digest/YYYY-MM-DD` as JSON (`rows`, `badLines`, and event `counts`).

```sh
pnpm test
pnpm typecheck
```

## Public review preview

`pnpm preview:export` fetches the actual digest from a temporary local server into the ignored
`.preview/index.html`. It reads `.env` if present; the output is public-ready, so use only the
sample run data and the issued marker. Never commit or attach the HTML or `.env`.

To publish, configure GitHub Pages to use Actions, provision the repository secret `LANE_MARKER`,
and manually dispatch the Preview deployment workflow with `include_marker` true (the default).
Nothing deploys on a push. The public URL is https://clentfort.github.io/mega-dev-s01e04/.
Verify the published page and send the reviewer that URL and the plan issues.

After review, and only with separate approval, manually dispatch the same workflow with
`include_marker` false to overwrite that URL with the “no marker set” banner; verify it. To
remove the public site entirely, disable GitHub Pages in repository settings.

After cleanup, the preview remains at that URL with the “no marker set” banner. The completed
[morning digest plan](docs/plans/done/2026-10-29-morning-digest.md) includes its issue list.

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
