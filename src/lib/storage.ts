import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function client() {
  return new S3Client({
    endpoint: env('AWS_ENDPOINT_URL'),
    region: process.env.AWS_DEFAULT_REGION ?? 'auto',
    forcePathStyle: process.env.AWS_S3_URL_STYLE !== 'virtual-hosted',
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID'),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY')
    }
  });
}

const bucket = () => env('AWS_S3_BUCKET_NAME');

export async function createUploadUrl(key: string, contentType: string, size: number) {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 900 }
  );
}

export async function createReadUrl(key: string) {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: 3600
  });
}
