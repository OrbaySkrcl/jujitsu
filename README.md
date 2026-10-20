# JUJITSU

**Free, open-source AI character replacement studio.** Replace the character in an existing video using reference images while preserving the original performance. Built by [@pedroshakoor](https://github.com/Pedroshakoor).

[Try the hosted studio](https://jujistsu.up.railway.app/) · [Source code](https://github.com/Pedroshakoor/jujistsu)

> JUJITSU is free software. The BytePlus ModelArk API and object storage may charge for usage. JUJITSU is an independent interface, not an official BytePlus product.

## Features

- MP4/MOV source clips (4–30 seconds) and up to 30 reference images
- Real Seedance 2.5 edit tasks via the BytePlus ModelArk API
- 480p, 720p, 1080p; up to four independently generated outputs
- Optional instructions using `@Video 1` and `@Image 1` references
- Browser-local job history, statuses, output previews, and estimated token costs
- Bring your own BytePlus API key or configure a server-side API key
- S3-compatible direct uploads; Next.js Docker/Railway deployment

## Quick start

Requires Node.js, a BytePlus ModelArk key, and an S3-compatible object storage bucket.

```bash
git clone https://github.com/Pedroshakoor/jujistsu.git
cd jujistsu
cp env.example.txt .env.local
npm ci
npm run dev
```

Set your S3 bucket connection variables in `.env.local` and configure bucket CORS for `PUT` from your deployed site origin with the `Content-Type` header. Open http://localhost:3000. Enter your BytePlus ModelArk API key in the studio and use **Save & verify**.

### Run in GitHub Codespaces (no local install)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/OrbaySkrcl/jujitsu)

Everything runs in a cloud container in your browser; nothing is installed on your computer.

1. Click the badge above (or **Code → Codespaces → Create codespace** on GitHub).
2. Add your secrets under GitHub **Settings → Codespaces → Secrets** for this repository: `APP_ACCESS_KEY`, the `AWS_*` storage variables, and optionally `ARK_API_KEY`. You can edit `.env.local` in the codespace instead, but secrets survive rebuilds and are never committed.
3. Wait for setup to finish. The dev server starts automatically and port 3000 opens in a new tab.

Keep the forwarded port **Private** (the default) so only your GitHub account can reach it. Stop the codespace when you are done; the free monthly quota is counted while it runs.

For private workspaces, set `APP_ACCESS_KEY` to a strong password. Uploaded footage and reference images are stored in the configured bucket, and presigned URLs temporarily grant access to those objects. Apply bucket lifecycle policies to delete old inputs.

**Security and cost warning:** By default, anonymous upload signing is disabled unless `APP_ACCESS_KEY` is configured. Only set `ALLOW_PUBLIC_UPLOADS=true` when you intentionally permit public usage and have enforced quotas/rate limits at your deployment edge; it may create storage bills. Setting a shared server `ARK_API_KEY` also exposes that account's paid model usage to anyone with workspace access. Avoid deploying a publicly funded instance without external authentication and cost controls.

The browser stores a verified BYOK API key in tab-scoped session storage, sends it to the JUJITSU backend over HTTPS, and the backend forwards it to BytePlus. Only enter keys on instances you trust. Job history is browser-local rather than a server account system.

## What it is — and isn't

JUJITSU is a real user interface for the Seedance 2.5 video-edit endpoint (`dreamina-seedance-2-5-260628`). It does not train or host its own AI model; model behavior and availability depend on BytePlus. It does not provide free model inference or retrieve your BytePlus account balance. Cost figures are estimates, not billing guarantees. Character consistency and footage preservation depend on the model and input materials.

Only upload videos and likenesses you have permission to use. Respect copyright, privacy, and applicable consent requirements.

## Deployment checklist

1. Set `APP_ACCESS_KEY` in Railway before inviting public traffic, and do not publish this key.
2. Configure your object-storage bucket with CORS restricted to your exact site origin and configure automatic deletion of old `inputs/` objects (recommended 24 hours; longer if active tasks need them).
3. Use a BYOK deployment whenever possible; avoid making a server-funded `ARK_API_KEY` available to strangers.
4. Add distributed rate limits and storage usage/billing alerts at your reverse proxy or platform for any public instance. Built-in request quotas are per process and reset on deployment; they do not constitute full abuse protection.
5. Validate a complete upload, character-replacement generation, polling, and download with your own BytePlus key before launch.

## Development

```bash
npm run typecheck
npm run lint
npm run build
```

## License

MIT © 2026 [pedroshakoor](https://github.com/Pedroshakoor). See [LICENSE](LICENSE).
