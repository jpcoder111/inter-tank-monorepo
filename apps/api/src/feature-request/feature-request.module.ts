import { Module } from '@nestjs/common';
import { FeatureRequestService } from './feature-request.service';
import { FeatureRequestController } from './feature-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [FeatureRequestController],
  providers: [FeatureRequestService],
})
export class FeatureRequestModule {}
