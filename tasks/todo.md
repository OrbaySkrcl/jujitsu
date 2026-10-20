# Task: Fork security audit + run without local install

## Understanding
1. Is this forked repo (upstream: Pedroshakoor/jujistsu, author "Pedro" / labofeight-ops) safe?
2. Can it run in a virtual/cloud environment instead of being installed on the user's PC?

## Plan
- [x] Audit all source (`src/`, configs, Dockerfile, CI workflow, `.agents/` AI skill files)
- [x] Scan git history for removed or hidden malicious code (install hooks, `child_process`, webhooks, exfiltration)
- [x] Check lockfile sources and install scripts
- [x] `npm audit` for known vulnerabilities
- [x] Upgrade vulnerable deps with the smallest well-aged fix (`next` 16.2.12 → 16.3.8, `oxfmt` → 0.67.0)
- [x] Add `.devcontainer/devcontainer.json` so the app runs in GitHub Codespaces (browser, nothing on the PC)
- [x] Document the Codespaces flow in README
- [x] Verify: `npm audit`, `typecheck`, `lint`, `build`, dev server responds, devcontainer boots in Docker
- [x] Commit and push to `claude/fervent-dirac-8yxj8l`

## Review / Results

### Security verdict: no malicious code found
- App code is about 390 lines. It only talks to its own `/api/*`, BytePlus (`ark.ap-southeast.bytepluses.com`) and your own S3 bucket. There is no `eval`, `child_process`, hidden network calls, telemetry, or credential exfiltration.
- No `preinstall`/`postinstall` scripts in `package.json`. All 169 lockfile packages resolve from `registry.npmjs.org`.
- Git history (22 commits, one author, all dated 2026-10-12) started from the Kiranism shadcn dashboard template. Its deleted `scripts/cleanup.js` only ran `git rev-parse`, so it was harmless.
- `.agents/skills/*` are standard AI-assistant prompt files from Vercel and shadcn. They contain no injected instructions. Claude Code does not load `.agents/`.
- CI workflow is read-only (`permissions: contents: read`).

### Real risk found and fixed: vulnerable dependencies
- `npm audit` before: 5 vulnerabilities (3 critical, 2 high). They were in `next` 16.2.12 (RCE/SSRF/cache poisoning advisories), its bundled `postcss` and `sharp`, and dev-only `tinypool` via `oxfmt`.
- After `next` 16.3.8 + `oxfmt` 0.67.0: **0 vulnerabilities**. I chose the oldest fixed releases (3 and 6 weeks old), not the newest ones, to limit supply-chain risk from very fresh publishes.

### Low-severity notes (not changed)
- Rate limits are in-memory and keyed by client-supplied headers, so they are easy to bypass. The author documents this.
- `GET /api/generations/[id]` skips the "server key needs `APP_ACCESS_KEY`" guard. The impact is low because task IDs are unguessable and the route only reads status.
- Don't enter your BytePlus key on the upstream hosted demo (`jujistsu.up.railway.app`). Its server receives the key. Self-host instead.

### Run without installing: GitHub Codespaces
- Added `.devcontainer/devcontainer.json` (Node 22 image, `npm ci --ignore-scripts`, auto `npm run dev`, port 3000 auto-opens, telemetry off).
- Added a README section with an "Open in Codespaces" badge.

### Verification
- `npm audit` → 0 vulnerabilities
- `npm run typecheck` → exit 0; `npm run lint` → exit 0 (4 warnings, same as before)
- `npm run build` → success, all 7 routes built
- Dev server: `/` → 200, `/api/config` → 200, presign without access key → 503 guard
- Devcontainer: ran the exact `postCreateCommand` and `postAttachCommand` inside `mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm`. The app served `/` with 200.
- An env var (Codespaces secret) overrides the empty `.env.local` value: `accessRequired: true`, and a wrong key gets 401.
