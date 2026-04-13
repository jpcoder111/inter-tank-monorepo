import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.appSetting.upsert({
      where: { id: 1 },
      create: { useNewConfirmationForm: false },
      update: {},
    });
  }

  async update(dto: UpdateAppSettingsDto) {
    return this.prisma.appSetting.upsert({
      where: { id: 1 },
      create: { useNewConfirmationForm: dto.useNewConfirmationForm ?? false },
      update: { useNewConfirmationForm: dto.useNewConfirmationForm },
    });
  }
}
