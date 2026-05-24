import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModeratorService } from 'src/moderator/moderator.service';
import { PrismaService } from 'src/prisma/prisma.service';

type GoogleOAuthTokensResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
  id_token?: string;
};

type YouTubeChannelProfile = {
  googleSub: string;
  channelId: string;
  title: string | null;
  description: string | null;
  customUrl: string | null;
  thumbnailUrl: string | null;
};

type UpdateYouTubeAuthorContentDto = {
  youtubeUserId: string;
  isAuthorContent: boolean;
};

@Injectable()
export class YouTubeUserService {
  private readonly logger = new Logger(YouTubeUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderatorService: ModeratorService,
  ) {}

  async addUpdateUser(
    tokens: GoogleOAuthTokensResponse,
    profile: YouTubeChannelProfile,
  ) {
    this.logger.log(
      [
        'Google OAuth tokens received',
        `scope=${tokens.scope}`,
        `hasAccessToken=${Boolean(tokens.access_token)}`,
        `hasRefreshToken=${Boolean(tokens.refresh_token)}`,
        `expiresIn=${tokens.expires_in}`,
        `tokenType=${tokens.token_type}`,
      ].join(' | '),
    );

    this.logger.log(
      [
        'YouTube profile received',
        `googleSub=${profile.googleSub}`,
        `channelId=${profile.channelId}`,
        `title=${profile.title ?? 'null'}`,
        `customUrl=${profile.customUrl ?? 'null'}`,
        `hasThumbnail=${Boolean(profile.thumbnailUrl)}`,
      ].join(' | '),
    );

    if (
      !tokens.scope.includes('https://www.googleapis.com/auth/youtube.readonly')
    ) {
      this.logger.warn(
        `YouTube аккаунт авторизован без youtube.readonly scope | channelId=${profile.channelId} | scope=${tokens.scope}`,
      );
    }

    if (!tokens.refresh_token) {
      this.logger.warn(
        `Google не вернул refresh_token | channelId=${profile.channelId} | title=${profile.title ?? 'null'}`,
      );
    }

    const accessExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const user = await this.prisma.youTubeUser.upsert({
      where: {
        youtube_channel_id: profile.channelId,
      },
      update: {
        google_sub: profile.googleSub,

        access_token: tokens.access_token,
        access_expires_in: tokens.expires_in,
        access_expires_at: accessExpiresAt,

        ...(tokens.refresh_token
          ? {
              refresh_token: tokens.refresh_token,
            }
          : {}),

        youtube_title: profile.title,
        youtube_description: profile.description,
        youtube_custom_url: profile.customUrl,
        youtube_thumbnail_url: profile.thumbnailUrl,
      },
      create: {
        google_sub: profile.googleSub,
        youtube_channel_id: profile.channelId,

        access_token: tokens.access_token,
        access_expires_in: tokens.expires_in,
        access_expires_at: accessExpiresAt,

        refresh_token: tokens.refresh_token,

        youtube_title: profile.title,
        youtube_description: profile.description,
        youtube_custom_url: profile.customUrl,
        youtube_thumbnail_url: profile.thumbnailUrl,
      },
    });

    this.logger.log(
      [
        'YouTube аккаунт сохранён',
        `id=${user.id}`,
        `channelId=${user.youtube_channel_id}`,
        `title=${user.youtube_title ?? 'null'}`,
        `moderatorId=${user.moderatorId ?? 'null'}`,
        `isAuthorContent=${user.isAuthorContent}`,
        `hasAccessToken=${Boolean(user.access_token)}`,
        `hasRefreshToken=${Boolean(user.refresh_token)}`,
        `accessExpiresAt=${user.access_expires_at.toISOString()}`,
      ].join(' | '),
    );

    return user;
  }

  async getById(id: string) {
    const youTubeUser = await this.prisma.youTubeUser.findUnique({
      where: {
        id,
      },
    });

    if (!youTubeUser) {
      throw new NotFoundException('YouTube аккаунт не найден');
    }

    return youTubeUser;
  }

  async debugById(id: string) {
    const user = await this.getById(id);

    this.logger.log(
      [
        'DEBUG YouTube user',
        `id=${user.id}`,
        `channelId=${user.youtube_channel_id}`,
        `title=${user.youtube_title ?? 'null'}`,
        `moderatorId=${user.moderatorId ?? 'null'}`,
        `hasAccessToken=${Boolean(user.access_token)}`,
        `hasRefreshToken=${Boolean(user.refresh_token)}`,
        `accessExpiresAt=${user.access_expires_at.toISOString()}`,
        `isAccessExpired=${user.access_expires_at.getTime() < Date.now()}`,
      ].join(' | '),
    );

    return {
      id: user.id,
      channelId: user.youtube_channel_id,
      title: user.youtube_title,
      customUrl: user.youtube_custom_url,
      moderatorId: user.moderatorId,
      isAuthorContent: user.isAuthorContent,
      hasAccessToken: Boolean(user.access_token),
      hasRefreshToken: Boolean(user.refresh_token),
      accessExpiresAt: user.access_expires_at,
      isAccessExpired: user.access_expires_at.getTime() < Date.now(),
    };
  }

  async getAllNotConnect() {
    return this.prisma.youTubeUser.findMany({
      where: {
        moderatorId: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async updateAuthorContent(
    moderatorId: string,
    dto: UpdateYouTubeAuthorContentDto,
  ) {
    const youTubeUser = await this.prisma.youTubeUser.findFirst({
      where: {
        id: dto.youtubeUserId,
        moderatorId,
      },
    });

    if (!youTubeUser) {
      throw new ConflictException('Аккаунт не привязан к этому модератору');
    }

    const updatedYouTubeUser = await this.prisma.youTubeUser.update({
      where: {
        id: dto.youtubeUserId,
      },
      data: {
        isAuthorContent: dto.isAuthorContent,
      },
    });

    return {
      isAuthorContent: updatedYouTubeUser.isAuthorContent,
    };
  }

  async delete(adminId: string, youtubeUserId: string) {
    const admin = await this.moderatorService.getModeratorById(adminId);

    if (!admin.isAdmin) {
      throw new UnauthorizedException(
        'У вас нет прав администратора для удаления YouTube аккаунта',
      );
    }

    await this.getById(youtubeUserId);

    return this.prisma.youTubeUser.delete({
      where: {
        id: youtubeUserId,
      },
    });
  }

  async updateModerator(
    adminId: string,
    youtubeUserId: string,
    moderatorId: string | null,
  ) {
    const admin = await this.moderatorService.getModeratorById(adminId);

    if (!admin.isAdmin) {
      throw new UnauthorizedException(
        'У вас нет прав администратора для изменения модератора аккаунта',
      );
    }

    await this.getById(youtubeUserId);

    if (moderatorId) {
      await this.moderatorService.getModeratorById(moderatorId);
    }

    return this.prisma.youTubeUser.update({
      where: {
        id: youtubeUserId,
      },
      data: {
        moderatorId,
      },
      include: {
        moderator: {
          select: {
            id: true,
            login: true,
          },
        },
      },
    });
  }

  async getForStatisticsByModeratorId(moderatorId: string) {
    const users = await this.prisma.youTubeUser.findMany({
      where: {
        moderatorId,
      },
    });

    this.logger.log(
      [
        'YouTube accounts for moderator statistics',
        `moderatorId=${moderatorId}`,
        `count=${users.length}`,
        `channels=${users
          .map(
            (user) =>
              `${user.youtube_title ?? user.youtube_channel_id}:${user.youtube_channel_id}`,
          )
          .join(', ')}`,
      ].join(' | '),
    );

    return users;
  }

  async getAllForStatistics() {
    const users = await this.prisma.youTubeUser.findMany({
      include: {
        moderator: {
          select: {
            id: true,
            login: true,
          },
        },
      },
    });

    this.logger.log(
      [
        'All YouTube accounts for statistics',
        `count=${users.length}`,
        `channels=${users
          .map(
            (user) =>
              `${user.youtube_title ?? user.youtube_channel_id}:${user.youtube_channel_id}`,
          )
          .join(', ')}`,
      ].join(' | '),
    );

    return users;
  }

  validateCanLoadStatistics(user: {
    id: string;
    youtube_channel_id: string;
    youtube_title: string | null;
    access_token: string | null;
  }) {
    if (!user.access_token) {
      throw new BadRequestException(
        `У YouTube аккаунта ${user.youtube_title ?? user.youtube_channel_id} нет access_token`,
      );
    }
  }
}
