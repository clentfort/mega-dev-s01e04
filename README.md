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

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
