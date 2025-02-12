import { GoogleOAuthGuard } from './google-oauth.guard';
import {
  Controller,
  Get,
  Request,
  UseGuards,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import process from 'node:process';

@Controller('auth')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Request() req) {}

  @Get('google-redirect')
  @UseGuards(GoogleOAuthGuard)
  googleAuthRedirect(@Request() req) {
    return this.appService.googleLogin(req);
  }

  @Post('tokens')
  async getTokens(@Body() body, @Res({ passthrough: true }) res: Response) {
    const result = await this.appService.getTokens(body);

    res.cookie('refresh_token', result.id_token, {
      httpOnly: true,
      secure: true,
      maxAge: 3600000,
    });

    return { access_token: result.id_token };
  }
}
