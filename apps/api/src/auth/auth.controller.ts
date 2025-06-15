import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto';
import { LocalAuthGuard } from './guards/local-auth/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth/refresh-auth.guard';
import { Public } from './decorators/plublic.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signUp(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUp(createUserDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('signin')
  signIn(@Request() req) {
    return this.authService.login(
      req.user.id,
      req.user.firstName,
      req.user.lastName,
    );
  }

  @Get('protected')
  getAll(@Request() req) {
    return {
      message: `Now you can access this protected route, this is your user id: ${req.user.id}`,
    };
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  refreshToken(@Request() req) {
    return this.authService.refreshToken(
      req.user.id,
      req.user.firstName,
      req.user.lastName,
    );
  }

  @Public()
  @Post('signout')
  signOut(@Request() req) {
    if (req.user) {
      return this.authService.signOut(req.user.id);
    }
    return {
      message: 'User not found',
    };
  }
}
