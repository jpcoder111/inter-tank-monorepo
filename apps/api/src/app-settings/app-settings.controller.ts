import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma';

@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get()
  async get() {
    return this.appSettingsService.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Body() dto: UpdateAppSettingsDto) {
    return this.appSettingsService.update(dto);
  }
}
