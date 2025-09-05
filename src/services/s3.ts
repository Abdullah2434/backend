import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import { S3Config, VideoUploadResult, VideoDownloadUrlResult } from '../types'

export class S3Service {
  private client: S3Client
  private bucketName: string
  private region: string
  constructor(cfg: S3Config) {
    const clientConfig: any = { region: cfg.region, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } }
    if (cfg.endpoint) clientConfig.endpoint = cfg.endpoint
    if (cfg.forcePathStyle) clientConfig.forcePathStyle = cfg.forcePathStyle
    this.client = new S3Client(clientConfig)
    this.bucketName = cfg.bucketName
    this.region = cfg.region
  }
  generateS3Key(userId: string, videoId: string, filename: string) {
    const ts = Date.now()
    const safe = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `videos/${userId}/${videoId}/${ts}_${safe}`
  }
  async uploadVideoDirectly(s3Key: string, buf: Buffer, contentType: string, metadata: Record<string, string>) {
    const cmd = new PutObjectCommand({ Bucket: this.bucketName, Key: s3Key, Body: buf, ContentType: contentType, Metadata: metadata })
    await this.client.send(cmd)
    return true
  }
  async createUploadUrl(userId: string, videoId: string, filename: string, contentType = 'video/mp4'): Promise<VideoUploadResult> {
    const s3Key = this.generateS3Key(userId, videoId, filename)
    const secretKey = crypto.randomBytes(32).toString('hex')
    const cmd = new PutObjectCommand({ Bucket: this.bucketName, Key: s3Key, ContentType: contentType })
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 3600 })
    return { s3Key, secretKey, uploadUrl }
  }
  async createDownloadUrl(s3Key: string, secretKey: string, expiresIn = 3600): Promise<VideoDownloadUrlResult> {
    const head = new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key })
    const info = await this.client.send(head)
    
    // Allow access if S3 metadata is undefined (for existing videos without metadata)
    if (info.Metadata?.secretKey && info.Metadata?.secretKey !== secretKey) {
      throw new Error('Invalid secret key for video access')
    }
    const cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key })
    const downloadUrl = await getSignedUrl(this.client, cmd, { expiresIn })
    return { downloadUrl, expiresIn }
  }
  async deleteVideo(s3Key: string, secretKey: string) {
    const head = new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key })
    const info = await this.client.send(head)
    if (info.Metadata?.secretKey !== secretKey) throw new Error('Invalid secret key for video deletion')
    const cmd = new DeleteObjectCommand({ Bucket: this.bucketName, Key: s3Key })
    await this.client.send(cmd)
    return true
  }
  getVideoUrl(s3Key: string) { return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}` }
}

let s3Singleton: S3Service | null = null
export function getS3() {
  if (!s3Singleton) {
    const bucketEnv = process.env.AWS_S3_BUCKET || ''
    const [bucketName] = bucketEnv.split('/')
    const cfg: S3Config = {
      region: process.env.AWS_REGION || 'us-east-1',
      bucketName,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
    if (process.env.AWS_S3_ENDPOINT) cfg.endpoint = process.env.AWS_S3_ENDPOINT
    if (process.env.AWS_S3_FORCE_PATH_STYLE === 'true') cfg.forcePathStyle = true
    if (!cfg.bucketName || !cfg.accessKeyId || !cfg.secretAccessKey) {
      throw new Error('AWS S3 configuration is incomplete. Please check environment variables.')
    }
    s3Singleton = new S3Service(cfg)
  }
  return s3Singleton
}


