import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFeatureRequestDto } from './dto';

@Injectable()
export class FeatureRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateFeatureRequestDto, userId: number) {
    return await this.prisma.featureRequest.create({
      data: {
        ...createDto,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findAll() {
    return await this.prisma.featureRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
