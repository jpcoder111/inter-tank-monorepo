import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Role } from '../../generated/prisma';
import { CreateFeatureRequestDto } from './dto';
import { FeatureRequestService } from './feature-request.service';

@Controller('feature-request')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class FeatureRequestController {
  constructor(private readonly featureRequestService: FeatureRequestService) {}

  @Post()
  create(@Body() createDto: CreateFeatureRequestDto, @Req() req: any) {
    return this.featureRequestService.create(createDto, req.user.id);
  }

  @Get()
  findAll() {
    return this.featureRequestService.findAll();
  }
}
