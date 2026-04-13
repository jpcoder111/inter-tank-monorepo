import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { R2Service } from 'src/r2/r2.service';
import { LocalStorageService } from '../local-storage/local-storage.service';

@Injectable()
export class FileService {
  private fileStorageService: R2Service | LocalStorageService;

  constructor(
    private readonly r2Service: R2Service,
    private readonly localStorageService: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {
    const hasR2Config =
      process.env.CLOUDFLARE_R2_BUCKET_NAME &&
      process.env.CLOUDFLARE_R2_ENDPOINT;

    this.fileStorageService = hasR2Config
      ? this.r2Service
      : this.localStorageService;
  }

  async uploadFile(file: Express.Multer.File, prefix: string = '') {
    const { key, url } = await this.fileStorageService.uploadFile(file, prefix);

    const fileRecord = await this.prisma.file.create({
      data: {
        mimeType: file.mimetype,
        size: file.size,
        key,
        publicUrl: url,
      },
    });

    return {
      fileRecord,
    };
  }

  async createFile(file: Express.Multer.File, prefix: string = '') {
    const { key, url } = await this.fileStorageService.uploadFile(file, prefix);

    const createdFile = await this.prisma.file.create({
      data: {
        mimeType: file.mimetype,
        size: file.size,
        key,
        publicUrl: url,
      },
    });

    return createdFile;
  }
}
