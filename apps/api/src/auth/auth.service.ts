import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { CreateUserDto } from 'src/user/dto';
import { UserService } from 'src/user/user.service';
import { AuthJwtPayload } from './types/auth-jwtPayload';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import refreshConfig from './config/refresh.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Inject(refreshConfig.KEY)
    private readonly refreshJwtConfiguration: ConfigType<typeof refreshConfig>,
  ) {}

  async signUp(createUserDto: CreateUserDto) {
    const user = await this.userService.findByEmail(createUserDto.email);

    if (user) {
      throw new ConflictException('User already exists');
    }

    return this.userService.create(createUserDto);
  }

  async validateLocalUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordMatches = await verify(user.password, password);

    if (!isPasswordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { id: user.id, firstName: user.firstName, lastName: user.lastName };
  }
  async login(userId: number, firstName?: string, lastName?: string) {
    const { accessToken, refreshToken } = await this.generateTokens(userId);
    const hashedRefreshToken = await hash(refreshToken);
    await this.userService.updateHashRefreshToken(userId, hashedRefreshToken);

    return {
      id: userId,
      firstName,
      lastName,
      accessToken,
      refreshToken,
    };
  }

  async generateTokens(userId: number) {
    const payload: AuthJwtPayload = {
      sub: userId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshJwtConfiguration),
    ]);

    return { accessToken, refreshToken };
  }

  async validateJwtUser(userId: number) {
    const user = await this.userService.findOne(userId);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const currentUser = { id: user.id };

    return currentUser;
  }

  async validateRefreshToken(userId: number, refreshToken: string) {
    const user = await this.userService.findOne(userId);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isRefreshTokenMatches = await verify(
      user.hashedRefreshToken || '',
      refreshToken,
    );

    if (!isRefreshTokenMatches)
      throw new UnauthorizedException('Invalid refresh token');

    const currentUser = { id: user.id };

    return currentUser;
  }

  async refreshToken(userId: number, firstName?: string, lastName?: string) {
    const { accessToken, refreshToken } = await this.generateTokens(userId);
    const hashedRefreshToken = await hash(refreshToken);
    await this.userService.updateHashRefreshToken(userId, hashedRefreshToken);

    return { id: userId, firstName, lastName, accessToken, refreshToken };
  }

  async signOut(userId: number) {
    await this.userService.updateHashRefreshToken(userId, null);
  }
}
