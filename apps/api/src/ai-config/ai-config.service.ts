import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveConfig() {
    return this.prisma.promptVersion.findFirst({
      orderBy: { version: 'desc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getAllVersions() {
    return this.prisma.promptVersion.findMany({
      orderBy: { version: 'desc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async createVersion(data: {
    model: string;
    prompt: string;
    createdById: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.promptVersion.findFirst({
        orderBy: { version: 'desc' },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      return tx.promptVersion.create({
        data: {
          version: nextVersion,
          model: data.model,
          prompt: data.prompt,
          createdById: data.createdById,
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    });
  }
}
