import { Module } from '@nestjs/common';
import { ConfirmationService } from './confirmation.service';
import { ConfirmationController } from './confirmation.controller';
import { FileModule } from 'src/file/file.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OcrModule } from 'src/ocr/ocr.module';
import { AiService } from 'src/ai/ai.service';

@Module({
  imports: [FileModule, PrismaModule, OcrModule],
  providers: [ConfirmationService, AiService],
  controllers: [ConfirmationController],
})
export class ConfirmationModule {}
