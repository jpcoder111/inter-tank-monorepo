import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { UploaderModule } from './uploader/uploader.module';
import { ConfirmationModule } from './confirmation/confirmation.module';
import { AiConfigModule } from './ai-config/ai-config.module';
import { FeatureRequestModule } from './feature-request/feature-request.module';
import { AppSettingsModule } from './app-settings/app-settings.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UploaderModule,
    ConfirmationModule,
    AiConfigModule,
    FeatureRequestModule,
    AppSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
