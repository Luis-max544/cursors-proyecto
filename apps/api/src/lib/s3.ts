import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@nutrilearn/config'

export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

export async function generatePresignedGetUrl(key: string, ttlSeconds: number): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds })
}

export async function generatePresignedPutUrl(key: string, ttlSeconds: number): Promise<string> {
  const command = new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds })
}
