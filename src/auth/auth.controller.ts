import { GoogleOAuthGuard } from './guard/google-oauth.guard';
import {
  Controller,
  Get,
  Request,
  HttpCode,
  UnauthorizedException,
  UseGuards,
  Post,
  Body,
  Res,
  Logger,
  Response as Ress,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import process from 'node:process';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Get()
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Request() req) {}

  @Get('google-redirect')
  @UseGuards(GoogleOAuthGuard)
  googleAuthRedirect(@Request() req) {
    return this.authService.googleLogin(req);
  }

  @Post('tokens')
  async getTokens(@Body() body, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.getTokens(body);

    res.cookie('refresh_token', result.id_token, {
      httpOnly: true,
      secure: true,
      maxAge: 3600000,
    });

    return { access_token: result.id_token };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async loginTest(@Request() req) {
    const userWithoutPsw: Partial<User> = req.user;

    return this.authService.loginTest(userWithoutPsw);
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async register(@Ress() response, @Request() request) {
    const { otpAuthUrl } =
      await this.authService.generateTwoFactorAuthenticationSecret(
        request.user,
      );

    return response.json(
      await this.authService.generateQrCodeDataURL(otpAuthUrl),
    );
  }

  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  async turnOnTwoFactorAuthentication(@Request() request, @Body() body) {
    const isCodeValid = this.authService.isTwoFactorAuthenticationCodeValid(
      body.twoFactorAuthenticationCode,
      request.user,
    );
    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }
    await this.usersService.turnOnTwoFactorAuthentication(request.user.id);
  }

  @Post('2fa/authenticate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async authenticate(@Request() request, @Body() body) {
    Logger.log(request.user)
    const isCodeValid = this.authService.isTwoFactorAuthenticationCodeValid(
      body.twoFactorAuthenticationCode,
      request.user,
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Wrong authentication code');
    }

    return this.authService.loginWith2fa(request.user);
  }
}
