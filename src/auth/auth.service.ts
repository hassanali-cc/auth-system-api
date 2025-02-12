import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import axios from 'axios';
import * as qs from 'qs';
import * as process from 'node:process';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}
  private googleTokenUrl = process.env.GOOGLE_TOKEN_URL;
  private clientId = process.env.GOOGLE_CLIENT_ID;
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private redirectUri = process.env.REDIRECT_URI;

  googleLogin(req) {
    if (!req.user) {
      return 'No users from google';
    }

    return {
      message: 'User information from google',
      user: req.user,
    };
  }

  async getTokens({ code }) {
    if (!code) return 'No code from google';
    const result = await this.getGoogleAccessToken(code);
    const userInfo = await this.getUserDataFromGoogle(result.access_token);

    const userFromDb = await this.databaseService.user.findUnique({
      where: { email: userInfo.email },
    });

    if (!userFromDb) {
      throw new HttpException(
        `No user exists with this email, you need to sign up first in the system.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return result;
  }

  async getGoogleAccessToken(authCode: string) {
    try {
      const data = qs.stringify({
        code: authCode,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });
      const response = await axios.post(this.googleTokenUrl, data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      return response.data;
    } catch (error) {
      throw new HttpException(
        `Error getting access token: ${
          error.response?.data?.error || error.message
        }`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getUserDataFromGoogle(accessToken: string) {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw new Error('Failed to fetch user data');
    }
  }

  async validateUser(email: string, pass: string): Promise<Partial<User>> {
    const user = await this.usersService.findOneTest(email);
    try {
      const isMatch = pass === user.password;
      if (user && isMatch) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    } catch (e) {
      return null;
    }
  }

  async loginTest(userWithoutPsw: Partial<User>) {
    const payload = {
      email: userWithoutPsw.email,
    };

    return {
      email: payload.email,
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginWith2fa(userWithoutPsw: Partial<User>) {
    const payload = {
      email: userWithoutPsw.email,
      isTwoFactorAuthenticationEnabled:
        !!userWithoutPsw.isTwoFactorAuthenticationEnabled,
      isTwoFactorAuthenticated: true,
    };

    return {
      email: payload.email,
      access_token: this.jwtService.sign(payload),
    };
  }

  async generateTwoFactorAuthenticationSecret(user: User) {
    const secret = authenticator.generateSecret();

    const otpAuthUrl = authenticator.keyuri(
      user.email,
      'AUTH_APP_NAME',
      secret,
    );

    await this.usersService.setTwoFactorAuthenticationSecret(
      secret,
      user.userId,
    );

    return {
      secret,
      otpAuthUrl,
    };
  }

  async generateQrCodeDataURL(otpAuthUrl: string) {
    return toDataURL(otpAuthUrl);
  }

  isTwoFactorAuthenticationCodeValid(
    twoFactorAuthenticationCode: string,
    user: User,
  ) {
    return authenticator.verify({
      token: twoFactorAuthenticationCode,
      secret: user.twoFactorAuthenticationSecret,
    });
  }
}
