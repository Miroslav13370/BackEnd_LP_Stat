import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

import { createModeratorDTO } from 'src/moderator/dto/moderator.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { id } = req.user as {
      id: string;
      refreshToken: string;
    };

    await this.authService.logout(id);

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    return {
      success: true,
    };
  }

  @Get('instagram')
  redirectToInstagram(@Res() res: Response) {
    return res.redirect(this.authService.getInstagramAuthUrl());
  }

  @Get('instagram/callback')
  async instagramCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('error_code') errorCode: string,
    @Query('error_message') errorMessage: string,
    @Res() res: Response,
  ) {
    if (error || errorCode) {
      console.log('INSTAGRAM AUTH ERROR:', {
        error,
        errorCode,
        errorMessage,
      });

      return res.redirect(
        `${process.env.CLIENT_URL}/?instagramError=${encodeURIComponent(
          errorMessage || error || 'Instagram auth error',
        )}`,
      );
    }

    if (!code) {
      throw new UnauthorizedException('Instagram не вернул code');
    }

    const user = await this.authService.getInstagramTokens(code);

    return res.redirect(`${process.env.CLIENT_URL}/instagram/${user.id}`);
  }

  @Get('youtube')
  redirectToGoogleYoutube(@Res() res: Response) {
    return res.redirect(this.authService.getGoogleYoutubeAuthUrl());
  }

  @Get('youtube/callback')
  async youtubeCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${process.env.CLIENT_URL}/?youtubeError=${error}`);
    }

    if (!code) {
      throw new UnauthorizedException('Google не вернул code');
    }

    const user = await this.authService.getYoutubeTokens(code);

    return res.redirect(`${process.env.CLIENT_URL}/youtube/${user.id}`);
  }

  @Get('tiktok')
  redirectToTikTok(@Res() res: Response) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    const params = new URLSearchParams({
      client_key: clientKey!,
      response_type: 'code',
      scope: 'user.info.basic,user.info.profile,video.list',
      redirect_uri: redirectUri!,
      state: crypto.randomUUID(),
    });

    return res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`);
  }

  @Get('tiktok/callback')
  async tiktokCallback(@Query('code') code: string, @Res() res: Response) {
    const user = await this.authService.getTikTokTokens(code);

    return res.redirect(`${process.env.CLIENT_URL}/tiktok/${user.id}`);
  }

  @Post('register')
  async register(
    @Body() dto: createModeratorDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = await this.authService.register(dto);

    res.cookie('accessToken', auth.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', auth.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return auth.moderator;
  }

  @Post('login')
  async login(
    @Body() dto: createModeratorDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const auth = await this.authService.login(dto);

    res.cookie('accessToken', auth.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', auth.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return auth.moderator;
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('updateToken')
  async updateAccessToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, refreshToken } = req.user as {
      id: string;
      refreshToken: string;
    };

    const accessToken = await this.authService.updateAccessToken(
      id,
      refreshToken,
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
    };
  }

  @Post('updateAllUser')
  updateAllTiktokUsers() {
    return this.authService.updateAllTiktokUsers();
  }

  @Post('updateAllYoutubeUser')
  updateAllYoutubeUsers() {
    return this.authService.updateAllYoutubeUsers();
  }
}
