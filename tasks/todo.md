# Task 2: Ready-to-use hosted studio for a non-coder

## Understanding
The user doesn't code. They only want to open a link, pick their character image and a video, and get the swapped video.

## Plan
- [x] Create Railway project `jujitsu` in the user's personal workspace
- [x] Create a Railway storage bucket `uploads` (S3-compatible, needed for video/image uploads)
- [x] Create the app service with bucket credentials as variable references, a strong `APP_ACCESS_KEY` and virtual-hosted URL style
- [x] Deploy from `OrbaySkrcl/jujitsu` branch `claude/fervent-dirac-8yxj8l` (Dockerfile build)
- [x] Generate a public `*.up.railway.app` domain
- [x] Configure bucket CORS so the browser can upload (PUT) from that domain only. Railway redacts bucket secrets from the API, so a pre-deploy script (`scripts/configure-bucket-cors.mjs`) does this with the service's own credentials.
- [x] Verify: deployment SUCCESS. Railway edge logs show external `GET /api/config` → 200 and `GET /` → 200. The pre-deploy log shows `PutBucketCors` succeeded on the real bucket. Not verifiable from this sandbox: a live browser upload, because the proxy blocks `*.up.railway.app` and `*.storageapi.dev`.
- [x] Review the end-to-end path and research BytePlus setup steps (multi-agent workflow, 8 agents)
- [x] Apply cheap hardening from the review
- [x] Hand over: link, password, and BytePlus key steps in plain Turkish (password shared in chat only, never committed)

## Review / Results (Task 2)
- Live at `https://studio-production-9656.up.railway.app`, protected by `APP_ACCESS_KEY`. Users bring their own BytePlus key (BYOK). No server `ARK_API_KEY`, so nobody else can spend the user's money.
- The code-path review confirmed these with local runs and a mock Ark server:
  - Signed headers are only `content-length;host`, and the CORS rule covers the preflight.
  - Gating works, and the generation request body matches the Seedance 2.5 edit spec.
  - Polling works with the user's own key.
- Hardening applied after the review:
  - Set `AWS_REQUEST_CHECKSUM_CALCULATION` and `AWS_RESPONSE_CHECKSUM_VALIDATION` to `WHEN_REQUIRED` (Railway variables). This drops `x-amz-checksum-crc32=AAAAAA==` (the CRC32 of an empty body) from presigned PUT URLs. Tigris doesn't enforce it today, but it's a latent break, and I verified locally that the params disappear.
  - Raised the upload quota from 30 to 200/hour. It's keyed on the shared access key, and one max-reference job alone needs 31 presigns.
  - Raised the presigned read URLs handed to Seedance from 1 h to 24 h, because queued tasks can start later.
- **Provider limitation (not fixable in code):** Seedance 2.0/2.5 rejects inputs with real human faces (`InputImageSensitiveContentDetected.PrivacyInformation`) unless the person is enrolled in BytePlus's invite-only real-human asset library. Illustrated, 3D or anime characters work.
- Known low-severity UX issues, left as is:
  - Re-selecting the same file after removing it does nothing. Reloading the page fixes it.
  - Uploading before entering the access key fails with "Invalid access key".
  - Batches of 2–4 outputs lose tasks if one of them fails partway, so keep Outputs at 1.

---

# Task 1: Fork security audit + run without local install

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
