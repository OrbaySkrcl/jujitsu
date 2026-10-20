# Lessons

- `next dev` (16.3+) writes `AGENTS.md` and `CLAUDE.md` to the project root when it detects an AI agent is running it (`ensureAgentRulesForDev` in `next/dist/server/lib/app-info-log.js`). They are not part of the app. Delete them after agent-driven dev runs rather than committing them unasked.
- Next.js refuses to start a second `next dev` in the same directory. Stop the first server before starting another one on a different port.
- Don't `pkill -f "<pattern>"` from the agent shell: the pattern matches the shell's own command line and kills it. Kill by PID instead.
- When picking a security fix version, prefer the oldest release that clears `npm audit` over the newest one. Very fresh publishes carry supply-chain risk.
