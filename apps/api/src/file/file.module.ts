import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { R2Module } from 'src/r2/r2.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OcrModule } from 'src/ocr/ocr.module';
import { LocalStorageModule } from 'src/local-storage/local-storage.module';

@Module({
  imports: [R2Module, PrismaModule, OcrModule, LocalStorageModule],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
