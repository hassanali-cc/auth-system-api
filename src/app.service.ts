import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import axios from 'axios';
import * as qs from 'qs';
import * as process from 'node:process';

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}
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
}
