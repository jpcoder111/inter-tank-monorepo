import {
  GetObjectCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'uploads') {
    const fileExtension = file.originalname.split('.').pop();

    const key = `${folder}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      Metadata: {
        uploadDate: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);

    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, getCommand, {
      expiresIn: 3600,
    });

    return {
      key,
      url: signedUrl,
    };
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
