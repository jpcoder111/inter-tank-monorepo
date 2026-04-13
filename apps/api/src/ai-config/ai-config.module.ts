import { Module } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiConfigController } from './ai-config.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [AiConfigController],
  providers: [AiConfigService],
  exports: [AiConfigService],
})
export class AiConfigModule {}
