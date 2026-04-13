import { Module } from '@nestjs/common';
import { ConfirmationService } from './confirmation.service';
import { ConfirmationController } from './confirmation.controller';
import { FileModule } from 'src/file/file.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OcrModule } from 'src/ocr/ocr.module';
import { AiService } from 'src/ai/ai.service';
import { AiConfigModule } from 'src/ai-config/ai-config.module';

@Module({
  imports: [FileModule, PrismaModule, OcrModule, AiConfigModule],
  providers: [ConfirmationService, AiService],
  controllers: [ConfirmationController],
})
export class ConfirmationModule {}
