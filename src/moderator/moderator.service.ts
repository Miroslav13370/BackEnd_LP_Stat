import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'argon2';

import { PrismaService } from 'src/prisma/prisma.service';
import {
  connectconnectTikTokUserDTO,
  createModeratorDTO,
} from './dto/moderator.dto';

@Injectable()
export class ModeratorService {
  constructor(private readonly prisma: PrismaService) {}

  private async clearStatisticsCache(moderatorId?: string) {
    await this.prisma.statisticsCache.deleteMany({
      where: {
        OR: [
          {
            type: {
              in: ['admin-tiktok-users', 'admin-moderators'],
            },
          },
          ...(moderatorId
            ? [
                {
                  ownerId: moderatorId,
                },
              ]
            : []),
        ],
      },
    });
  }

  async connectYouTubeUser({
    id: moderatorId,
    youTubeUsersIds,
  }: {
    id: string;
    youTubeUsersIds: string[];
  }) {
    const moderator = await this.prisma.moderator.findUnique({
      where: {
        id: moderatorId,
      },
    });

    if (!moderator) {
      throw new ConflictException('Модератор с таким id не найден');
    }

    const busyUsers = await this.prisma.youTubeUser.findMany({
      where: {
        id: {
          in: youTubeUsersIds,
        },
        moderatorId: {
          not: null,
        },
      },
      select: {
        id: true,
        youtube_title: true,
        moderatorId: true,
      },
    });

    if (busyUsers.length > 0) {
      throw new ConflictException(
        `Некоторые YouTube аккаунты уже привязаны: ${busyUsers
          .map((user) => user.youtube_title ?? user.id)
          .join(', ')}`,
      );
    }

    return this.prisma.moderator.update({
      where: {
        id: moderatorId,
      },
      data: {
        youTubeUser: {
          connect: youTubeUsersIds.map((id) => ({ id })),
        },
      },
      include: {
        tikTokUser: true,
        youTubeUser: true,
      },
    });
  }

  async disconnectYouTubeUser(moderatorId: string, youTubeUserId: string) {
    await this.getModeratorById(moderatorId);

    const youTubeUser = await this.prisma.youTubeUser.findFirst({
      where: {
        id: youTubeUserId,
        moderatorId,
      },
    });

    if (!youTubeUser) {
      throw new NotFoundException(
        'YouTube аккаунт не найден или уже отвязан от модератора',
      );
    }

    return this.prisma.moderator.update({
      where: {
        id: moderatorId,
      },
      data: {
        youTubeUser: {
          disconnect: {
            id: youTubeUserId,
          },
        },
      },
      include: {
        tikTokUser: true,
        youTubeUser: true,
      },
    });
  }

  async create({ login, password }: createModeratorDTO) {
    const existsModerator = await this.prisma.moderator.findUnique({
      where: {
        login,
      },
    });

    if (existsModerator) {
      throw new ConflictException('Модератор с таким логином уже существует');
    }

    const moderator = await this.prisma.moderator.create({
      data: {
        login,
        passwordHash: await hash(password),
      },
    });

    await this.clearStatisticsCache();

    return moderator;
  }

  async connectTikTokUser({
    id: moderatorId,
    tikTokUsersIds,
  }: connectconnectTikTokUserDTO) {
    const moderator = await this.prisma.moderator.findUnique({
      where: {
        id: moderatorId,
      },
    });

    if (!moderator) {
      throw new ConflictException('Модератор с таким id не найден');
    }

    const busyUsers = await this.prisma.tikTokUser.findMany({
      where: {
        id: {
          in: tikTokUsersIds,
        },
        moderatorId: {
          not: null,
        },
      },
      select: {
        id: true,
        tiktok_username: true,
        moderatorId: true,
      },
    });

    if (busyUsers.length > 0) {
      throw new ConflictException(
        `Некоторые аккаунты уже привязаны: ${busyUsers
          .map((user) => user.tiktok_username ?? user.id)
          .join(', ')}`,
      );
    }

    const updatedModerator = await this.prisma.moderator.update({
      where: {
        id: moderatorId,
      },
      data: {
        tikTokUser: {
          connect: tikTokUsersIds.map((id) => ({ id })),
        },
      },
      include: {
        tikTokUser: true,
      },
    });

    await this.clearStatisticsCache(moderatorId);

    return updatedModerator;
  }

  async getModeratorById(id: string) {
    const moderator = await this.prisma.moderator.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        isAdmin: true,
        login: true,
        tikTokUser: {
          select: {
            id: true,
            tiktok_open_id: true,
            tiktok_username: true,
            tiktok_display_name: true,
            tiktok_avatar_url: true,
            isAuthorContent: true,
            planTarget: true,
            moderatorId: true,
          },
        },
        youTubeUser: {
          select: {
            id: true,
            google_sub: true,
            youtube_channel_id: true,
            youtube_title: true,
            youtube_description: true,
            youtube_custom_url: true,
            youtube_thumbnail_url: true,
            isAuthorContent: true,
            planTarget: true,
            moderatorId: true,
          },
        },
      },
    });

    if (!moderator) {
      throw new NotFoundException('Модератор не найден');
    }

    return moderator;
  }

  async getModeratorByLogin(login: string) {
    const moderator = await this.prisma.moderator.findUnique({
      where: {
        login,
      },
      include: {
        tikTokUser: true,
        youTubeUser: true,
      },
    });

    if (!moderator) {
      throw new NotFoundException('Модератор не найден');
    }

    return moderator;
  }

  async disconnectTikTokUser(moderatorId: string, tikTokUserId: string) {
    await this.getModeratorById(moderatorId);

    const tikTokUser = await this.prisma.tikTokUser.findFirst({
      where: {
        id: tikTokUserId,
        moderatorId,
      },
    });

    if (!tikTokUser) {
      throw new NotFoundException(
        'TikTok аккаунт не найден или уже отвязан от модератора',
      );
    }

    const updatedModerator = await this.prisma.moderator.update({
      where: {
        id: moderatorId,
      },
      data: {
        tikTokUser: {
          disconnect: {
            id: tikTokUserId,
          },
        },
      },
      include: {
        tikTokUser: true,
      },
    });

    await this.clearStatisticsCache(moderatorId);

    return updatedModerator;
  }

  async delete(adminId: string, moderatorId: string) {
    const admin = await this.getModeratorById(adminId);

    if (!admin.isAdmin) {
      throw new NotFoundException('У вас нет прав администратора для удаления');
    }

    await this.getModeratorById(moderatorId);

    const deletedModerator = await this.prisma.moderator.delete({
      where: {
        id: moderatorId,
      },
    });

    await this.clearStatisticsCache(moderatorId);

    return deletedModerator;
  }
}
