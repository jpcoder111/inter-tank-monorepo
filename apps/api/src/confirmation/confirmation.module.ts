import { Module } from '@nestjs/common';
import { ConfirmationService } from './confirmation.service';
import { ConfirmationController } from './confirmation.controller';
import { AiService } from 'src/ai/ai.service';
import { FileModule } from 'src/file/file.module';

@Module({
  imports: [FileModule],
  providers: [ConfirmationService, AiService],
  controllers: [ConfirmationController],
})
export class ConfirmationModule {}
