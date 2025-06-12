import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { hash } from 'argon2';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { password, ...rest } = createUserDto;

    const hashedPassword = await hash(password);

    return await this.prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
      },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findOne(id: number) {
    return await this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async updateHashRefreshToken(id: number, hashedRefreshToken: string | null) {
    return await this.prisma.user.update({
      where: { id },
      data: { hashedRefreshToken },
    });
  }
}
