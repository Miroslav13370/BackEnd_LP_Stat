import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { hash, verify } from 'argon2';

import { ModeratorService } from 'src/moderator/moderator.service';
import { createModeratorDTO } from 'src/moderator/dto/moderator.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { YouTubeUserService } from 'src/you-tube-user/you-tube-user.service';

import {
  TikTokAccessTokenResponse,
  TikTokTokenResponse,
  TikTokUserInfoResponse,
} from 'src/types/tikTokTokenResponse.type';

import { GoogleOAuthTokensResponse } from 'src/types/GoogleOAuthTokensResponse.type';
import { JwtPayload } from './strategies/refresh.strategy';
import { InstagramUserService } from 'src/instagram-user/instagram-user.service';

type MetaOAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type MetaPagesResponse = {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type MetaPageInstagramResponse = {
  instagram_business_account?: {
    id: string;
  };
  connected_instagram_account?: {
    id: string;
  };
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type InstagramProfileResponse = {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type GoogleRefreshTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: 'Bearer';
  id_token?: string;
};

type GoogleIdTokenPayload = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

type YouTubeChannelsResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      thumbnails?: {
        default?: {
          url?: string;
        };
        medium?: {
          url?: string;
        };
        high?: {
          url?: string;
        };
      };
    };
  }>;
};

export type MetaMeAccountsResponse = {
  accounts?: {
    data?: Array<{
      id: string;

      name: string;

      access_token: string;
    }>;
  };

  error?: {
    message: string;

    type: string;

    code: number;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly moderatorService: ModeratorService,
    private readonly youTubeUserService: YouTubeUserService,
    private readonly instagramUserService: InstagramUserService,
  ) {}

  async signTokens(id: string) {
    const accessToken = await this.jwtService.signAsync<JwtPayload>(
      { id },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_ACCESS_EXPIRES'),
      },
    );

    const refreshToken = await this.jwtService.signAsync<JwtPayload>(
      { id },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES'),
      },
    );

    return { accessToken, refreshToken };
  }

  async logout(moderatorId: string) {
    await this.prisma.moderator.update({
      where: {
        id: moderatorId,
      },
      data: {
        refreshTokenHash: null,
      },
    });

    return {
      success: true,
    };
  }

  getGoogleYoutubeAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: this.configService.getOrThrow<string>(
        'GOOGLE_REDIRECT_URI',
      ),
      response_type: 'code',
      scope: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/youtube.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async getTikTokTokens(code: string) {
    const params = new URLSearchParams({
      client_key: this.configService.getOrThrow<string>('TIKTOK_CLIENT_KEY'),
      client_secret: this.configService.getOrThrow<string>(
        'TIKTOK_CLIENT_SECRET',
      ),
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.configService.getOrThrow<string>(
        'TIKTOK_REDIRECT_URI',
      ),
    });

    try {
      const response = await fetch(
        'https://open.tiktokapis.com/v2/oauth/token/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        },
      );

      const tokens = (await response.json()) as TikTokTokenResponse;

      if (!response.ok || !tokens.access_token) {
        throw new UnauthorizedException('TikTok не вернул access_token');
      }

      const profileResponse = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );

      const profileJson =
        (await profileResponse.json()) as TikTokUserInfoResponse;

      if (!profileResponse.ok || !profileJson.data?.user) {
        throw new UnauthorizedException('Не удалось получить профиль TikTok');
      }

      return this.userService.addUpdateUser(tokens, profileJson.data.user);
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Ошибка авторизации TikTok');
    }
  }

  private decodeGoogleIdToken(idToken: string) {
    const [, payload] = idToken.split('.');

    if (!payload) {
      throw new UnauthorizedException('Некорректный Google id_token');
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');

    const json = Buffer.from(normalizedPayload, 'base64').toString('utf8');

    return JSON.parse(json) as GoogleIdTokenPayload;
  }

  private async exchangeGoogleCodeToTokens(code: string) {
    const params = new URLSearchParams({
      client_id: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.configService.getOrThrow<string>(
        'GOOGLE_CLIENT_SECRET',
      ),
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.configService.getOrThrow<string>(
        'GOOGLE_REDIRECT_URI',
      ),
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = (await response.json()) as GoogleOAuthTokensResponse;

    if (!response.ok || !data.access_token) {
      console.log(data);
      throw new UnauthorizedException('Не удалось получить Google токены');
    }

    return data;
  }

  private async getYoutubeChannelProfile(tokens: GoogleOAuthTokensResponse) {
    if (!tokens.id_token) {
      throw new UnauthorizedException(
        'Google не вернул id_token. Проверь scopes: openid profile email youtube.readonly',
      );
    }

    const googlePayload = this.decodeGoogleIdToken(tokens.id_token);

    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      },
    );

    const data = (await response.json()) as YouTubeChannelsResponse;

    if (!response.ok) {
      console.log(data);
      throw new UnauthorizedException('Не удалось получить YouTube канал');
    }

    const channel = data.items?.[0];

    if (!channel) {
      throw new UnauthorizedException(
        'У Google аккаунта не найден YouTube канал',
      );
    }

    return {
      googleSub: googlePayload.sub,
      channelId: channel.id,
      title: channel.snippet?.title ?? null,
      description: channel.snippet?.description ?? null,
      customUrl: channel.snippet?.customUrl ?? null,
      thumbnailUrl:
        channel.snippet?.thumbnails?.high?.url ??
        channel.snippet?.thumbnails?.medium?.url ??
        channel.snippet?.thumbnails?.default?.url ??
        null,
    };
  }

  async getYoutubeTokens(code: string) {
    try {
      const tokens = await this.exchangeGoogleCodeToTokens(code);

      const profile = await this.getYoutubeChannelProfile(tokens);

      return this.youTubeUserService.addUpdateUser(tokens, profile);
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Ошибка авторизации YouTube');
    }
  }

  async updateTikTokAccessToken(refreshToken: string, id: string) {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key:
            this.configService.getOrThrow<string>('TIKTOK_CLIENT_KEY'),
          client_secret: this.configService.getOrThrow<string>(
            'TIKTOK_CLIENT_SECRET',
          ),
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      },
    );

    const newToken = (await response.json()) as TikTokAccessTokenResponse;

    if (!response.ok || !newToken.access_token) {
      const user = await this.prisma.tikTokUser.update({
        where: {
          id,
        },
        data: {
          isUpdate: true,
        },
      });

      throw new Error(
        `Ошибка обновления TikTok токена для аккаунта ${
          user.tiktok_username ?? user.id
        }`,
      );
    }

    return this.prisma.tikTokUser.update({
      where: {
        id,
      },
      data: {
        access_token: newToken.access_token,
        access_expires_in: newToken.expires_in,
        access_expires_at: new Date(Date.now() + newToken.expires_in * 1000),
        isUpdate: false,
      },
    });
  }

  async updateYouTubeAccessToken(refreshToken: string | null, id: string) {
    if (!refreshToken) {
      await this.prisma.youTubeUser.update({
        where: {
          id,
        },
        data: {
          isUpdate: true,
        },
      });

      throw new Error(`У YouTube аккаунта ${id} отсутствует refresh_token`);
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.configService.getOrThrow<string>(
          'GOOGLE_CLIENT_SECRET',
        ),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const newToken = (await response.json()) as GoogleRefreshTokenResponse;

    if (!response.ok || !newToken.access_token) {
      const user = await this.prisma.youTubeUser.update({
        where: {
          id,
        },
        data: {
          isUpdate: true,
        },
      });

      throw new Error(
        `Ошибка обновления YouTube токена для аккаунта ${
          user.youtube_title ?? user.id
        }`,
      );
    }

    return this.prisma.youTubeUser.update({
      where: {
        id,
      },
      data: {
        access_token: newToken.access_token,
        access_expires_in: newToken.expires_in,
        access_expires_at: new Date(Date.now() + newToken.expires_in * 1000),
        isUpdate: false,
      },
    });
  }

  @Cron('0 * * * *')
  async updateAllTiktokUsers() {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const usersToUpdate = await this.prisma.tikTokUser.findMany({
      where: {
        access_expires_at: {
          lte: twoHoursFromNow,
        },
      },
    });

    const batchSize = 10;

    for (let i = 0; i < usersToUpdate.length; i += batchSize) {
      const batch = usersToUpdate.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map((user) =>
          this.updateTikTokAccessToken(user.refresh_token, user.id),
        ),
      );
    }

    return true;
  }

  @Cron('15 * * * *')
  async updateAllYoutubeUsers() {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const usersToUpdate = await this.prisma.youTubeUser.findMany({
      where: {
        access_expires_at: {
          lte: twoHoursFromNow,
        },
      },
    });

    const batchSize = 10;

    for (let i = 0; i < usersToUpdate.length; i += batchSize) {
      const batch = usersToUpdate.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map((user) =>
          this.updateYouTubeAccessToken(user.refresh_token, user.id),
        ),
      );
    }

    return true;
  }

  async register(dto: createModeratorDTO) {
    const existsModerator = await this.moderatorService.create(dto);

    const { refreshToken, accessToken } = await this.signTokens(
      existsModerator.id,
    );

    const moderator = await this.prisma.moderator.update({
      where: {
        id: existsModerator.id,
      },
      data: {
        refreshTokenHash: await hash(refreshToken),
      },
    });

    return { moderator, refreshToken, accessToken };
  }

  async login(dto: createModeratorDTO) {
    const moderator = await this.moderatorService.getModeratorByLogin(
      dto.login,
    );

    const isValid = await verify(moderator.passwordHash!, dto.password);

    if (!isValid) {
      throw new UnauthorizedException('Неверный пароль');
    }

    const { refreshToken, accessToken } = await this.signTokens(moderator.id);

    await this.prisma.moderator.update({
      where: {
        id: moderator.id,
      },
      data: {
        refreshTokenHash: await hash(refreshToken),
      },
    });

    return { moderator, refreshToken, accessToken };
  }

  async updateAccessToken(id: string, oldRefreshToken: string) {
    const existsModerator = await this.prisma.moderator.findUnique({
      where: {
        id,
      },
    });

    if (!existsModerator?.refreshTokenHash) {
      throw new UnauthorizedException('refreshToken невалиден');
    }

    const isAuth = await verify(
      existsModerator.refreshTokenHash,
      oldRefreshToken,
    );

    if (!isAuth) {
      throw new UnauthorizedException('refreshToken невалиден');
    }

    const { accessToken } = await this.signTokens(id);

    return accessToken;
  }

  getInstagramAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.configService.getOrThrow<string>('INSTAGRAM_APP_ID'),
      redirect_uri: this.configService.getOrThrow<string>(
        'INSTAGRAM_REDIRECT_URI',
      ),
      response_type: 'code',
      scope: [
        'pages_show_list',

        'pages_read_engagement',

        'business_management',

        'instagram_basic',

        'instagram_manage_insights',
      ].join(','),
      auth_type: 'rerequest',
    });

    return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
  }

  private async exchangeInstagramCodeToToken(code: string) {
    const params = new URLSearchParams({
      client_id: this.configService.getOrThrow<string>('INSTAGRAM_APP_ID'),
      client_secret: this.configService.getOrThrow<string>(
        'INSTAGRAM_APP_SECRET',
      ),
      redirect_uri: this.configService.getOrThrow<string>(
        'INSTAGRAM_REDIRECT_URI',
      ),
      code,
    });

    const response = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`,
    );

    const data = (await response.json()) as MetaOAuthTokenResponse;

    if (!response.ok || !data.access_token) {
      console.log('META TOKEN ERROR:', data);
      throw new UnauthorizedException('Meta не вернул access_token');
    }

    return data;
  }

  private async getInstagramPageWithAccount(accessToken: string) {
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/permissions?access_token=${accessToken}`,
    );

    console.log('META PERMISSIONS:', await permissionsResponse.json());

    const pagesResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,tasks&access_token=${accessToken}`,
    );

    const pagesData = (await pagesResponse.json()) as MetaPagesResponse;

    console.log('META PAGES:', pagesData);

    const pages = pagesData.data ?? [];

    if (!pagesResponse.ok || pages.length === 0) {
      throw new UnauthorizedException('Meta не вернул Facebook Pages');
    }

    for (const page of pages) {
      const instagramResponse = await fetch(
        `https://graph.facebook.com/v23.0/${page.id}?fields=instagram_business_account,connected_instagram_account&access_token=${page.access_token}`,
      );

      const instagramData =
        (await instagramResponse.json()) as MetaPageInstagramResponse;

      console.log(`META PAGE INSTAGRAM ${page.name}:`, instagramData);

      const instagramAccountId =
        instagramData.instagram_business_account?.id ??
        instagramData.connected_instagram_account?.id;

      if (instagramResponse.ok && instagramAccountId) {
        return {
          page,
          instagramAccountId,
        };
      }
    }

    throw new UnauthorizedException(
      'Ни у одной Facebook Page не найден Instagram аккаунт',
    );
  }

  private async getInstagramProfile(
    instagramAccountId: string,
    pageAccessToken: string,
  ) {
    const fields = [
      'id',
      'username',
      'name',
      'biography',
      'profile_picture_url',
      'followers_count',
      'follows_count',
      'media_count',
    ].join(',');

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${instagramAccountId}?fields=${fields}&access_token=${pageAccessToken}`,
    );

    const data = (await response.json()) as InstagramProfileResponse;

    console.log('META INSTAGRAM PROFILE:', data);

    if (!response.ok || !data.id) {
      throw new UnauthorizedException('Не удалось получить Instagram профиль');
    }

    return data;
  }

  async getInstagramTokens(code: string) {
    try {
      const token = await this.exchangeInstagramCodeToToken(code);

      const { page, instagramAccountId } =
        await this.getInstagramPageWithAccount(token.access_token!);

      const profile = await this.getInstagramProfile(
        instagramAccountId,
        page.access_token,
      );

      return this.instagramUserService.addUpdateUser({
        facebookPageId: page.id,
        facebookPageName: page.name,
        instagramAccountId,
        pageAccessToken: page.access_token,
        tokenType: token.token_type ?? null,
        expiresIn: token.expires_in ?? null,
        profile,
      });
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Ошибка авторизации Instagram');
    }
  }
}
