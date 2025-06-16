import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { R2Service } from 'src/r2/r2.service';
import { OcrService } from 'src/ocr/ocr.service';
import { LocalStorageService } from '../local-storage/local-storage.service';

@Injectable()
export class FileService {
  private fileStorageService: R2Service | LocalStorageService;

  constructor(
    private readonly r2Service: R2Service,
    private readonly localStorageService: LocalStorageService,
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
  ) {
    this.fileStorageService =
      process.env.NODE_ENV === 'development'
        ? this.localStorageService
        : this.r2Service;
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
