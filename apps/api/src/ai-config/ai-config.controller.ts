import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma';

@Controller('ai-config')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AiConfigController {
  constructor(private readonly aiConfigService: AiConfigService) {}

  @Get('active')
  async getActiveConfig() {
    return this.aiConfigService.getActiveConfig();
  }

  @Get('versions')
  async getAllVersions() {
    return this.aiConfigService.getAllVersions();
  }

  @Post('versions')
  async createVersion(@Body() dto: CreatePromptVersionDto, @Request() req) {
    return this.aiConfigService.createVersion({
      ...dto,
      createdById: req.user.id,
    });
  }
}
