# Lessons

- `next dev` (16.3+) writes `AGENTS.md` and `CLAUDE.md` to the project root when it detects an AI agent is running it (`ensureAgentRulesForDev` in `next/dist/server/lib/app-info-log.js`). They are not part of the app. Delete them after agent-driven dev runs rather than committing them unasked.
- Next.js refuses to start a second `next dev` in the same directory. Stop the first server before starting another one on a different port.
- Don't `pkill -f "<pattern>"` from the agent shell: the pattern matches the shell's own command line and kills it. Kill by PID instead.
- When picking a security fix version, prefer the oldest release that clears `npm audit` over the newest one. Very fresh publishes carry supply-chain risk.
- AWS SDK v3 (>= 3.729) adds `x-amz-checksum-crc32` (the CRC32 of an empty body) and `x-amz-sdk-checksum-algorithm` to presigned PutObject URLs by default. A browser upload to an S3-compatible store that enforces it will fail. Set `requestChecksumCalculation`/`responseChecksumValidation` to `WHEN_REQUIRED`, or the matching `AWS_*` env vars.
- Railway's MCP redacts bucket secrets, so it can't run S3 admin calls (e.g. PutBucketCors) from outside. Run them inside the service, for example as a pre-deploy command that uses the injected credentials.
- This sandbox's proxy blocks `*.up.railway.app` and `*.storageapi.dev`. Verify Railway deployments through Railway's HTTP/deploy logs instead.
- Before a user pays a model provider, check the provider's content policy against the use case. Seedance 2.x blocks real human faces in its inputs.
