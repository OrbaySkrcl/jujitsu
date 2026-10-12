# Jujistsu Motion Studio

A production-ready motion-transfer and object-replacement workflow powered by the official BytePlus ModelArk Seedance 2.5 API.

## Features

- Motion Transfer and Object Swap workflows
- Direct browser uploads to Railway Object Storage
- Up to 30 reference images and 4 batch variations
- Style, prompt, and 480p/720p/1080p controls
- Asynchronous task polling, history, result comparison, and downloads
- Responsive dark interface based on the MIT-licensed Next Shadcn Dashboard Starter

## Configuration

Copy `env.example.txt` to `.env.local`, then configure:

```env
ARK_API_KEY=
AWS_ENDPOINT_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_DEFAULT_REGION=
```

The Seedance model and API endpoint already default to the official ModelArk values and can be overridden with `SEEDANCE_MODEL` and `SEEDANCE_API_BASE_URL`.

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
```

The included Dockerfile produces a standalone Next.js server suitable for Railway.
