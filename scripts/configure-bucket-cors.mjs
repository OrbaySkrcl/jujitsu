// Allows browser uploads (presigned PUT) to the bucket from this deployment's public domain.
// Runs as Railway's pre-deploy command, where the bucket credentials are available as variables.
import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

const bucket = process.env.AWS_S3_BUCKET_NAME;
const domain = process.env.RAILWAY_PUBLIC_DOMAIN;

if (!bucket || !process.env.AWS_ENDPOINT_URL || !domain) {
  console.log('Skipping bucket CORS: storage variables or RAILWAY_PUBLIC_DOMAIN not set');
  process.exit(0);
}

const origin = `https://${domain}`;
const client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_DEFAULT_REGION ?? 'auto',
  forcePathStyle: process.env.AWS_S3_URL_STYLE !== 'virtual-hosted'
});

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          { AllowedOrigins: [origin], AllowedMethods: ['PUT'], AllowedHeaders: ['*'], MaxAgeSeconds: 3000 }
        ]
      }
    })
  );
  console.log(`Bucket CORS allows uploads from ${origin}`);
} catch (error) {
  // Don't block the deploy; uploads will report a CORS error until this succeeds.
  console.error(`Bucket CORS update failed: ${error instanceof Error ? error.message : error}`);
}
