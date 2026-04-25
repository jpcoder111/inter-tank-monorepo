import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
