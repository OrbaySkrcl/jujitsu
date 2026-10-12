# Jujitsu

A single-page character-replacement workflow using the official BytePlus ModelArk Seedance 2.5 video-edit API.

## Real workflow

- Direct MP4/MOV and reference-image uploads to S3-compatible storage
- Official `dreamina-seedance-2-5-260628` edit task creation and polling
- 480p, 720p, 1080p and 1–4 independent outputs
- Browser-local history with real task IDs, output URLs, tokens, and list-rate estimates
- Optional workspace access key protecting paid API usage
- Bring-your-own Seedance API key input for public/self-hosted users

There are no example jobs, fake balance, preset library, object swap, or simulated outputs. ModelArk does not expose account balance through the generation API.

## Configure

Copy `env.example.txt` to `.env.local`:

```env
ARK_API_KEY=your_byteplus_modelark_api_key
APP_ACCESS_KEY=choose_a_shared_workspace_password
AWS_ENDPOINT_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_DEFAULT_REGION=
AWS_S3_URL_STYLE=
```

Users can paste their own BytePlus ModelArk key into the **Seedance API key** field. It remains in React memory for that tab and is sent only to the generation/status endpoints over HTTPS. It is never saved to browser storage.

Alternatively, a deployer can set `ARK_API_KEY` server-side for a shared account. Set `APP_ACCESS_KEY` on shared public deployments so strangers cannot spend the server API or storage balance. Configure bucket CORS to allow `PUT` from the deployed origin with `Content-Type`.

## Run

```bash
npm install
npm run dev
```

The Dockerfile uses Next.js standalone output and is ready for Railway.
