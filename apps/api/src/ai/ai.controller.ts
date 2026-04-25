import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma';

type ContentBlock = { type?: string } & Record<string, unknown>;

type ExtractRateBody = {
  system: string;
  content: string | ContentBlock[];
};

@Controller('ai')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('extract-rate')
  async extractRate(@Body() body: ExtractRateBody) {
    return this.aiService.extractRate(body.system, body.content);
  }
}
