import { ModeratorService } from 'src/moderator/moderator.service';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TikTokTokenResponse,
  TikTokUserProfile,
} from 'src/types/tikTokTokenResponse.type';
import { updateAuthorContentDto } from './dto/updateAuthorContent.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderatorService: ModeratorService,
  ) {}

  async addUpdateUser(tokens: TikTokTokenResponse, profile: TikTokUserProfile) {
    return await this.prisma.tikTokUser.upsert({
      where: {
        tiktok_open_id: tokens.open_id,
      },
      update: {
        access_token: tokens.access_token,
        access_expires_in: tokens.expires_in,
        refresh_token: tokens.refresh_token,
        refresh_expires_in: tokens.refresh_expires_in,
        tiktok_username: profile.username,
        tiktok_display_name: profile.display_name,
        tiktok_avatar_url: profile.avatar_url,
        access_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        refresh_expires_at: new Date(
          Date.now() + tokens.refresh_expires_in * 1000,
        ),
      },
      create: {
        tiktok_open_id: tokens.open_id,
        access_token: tokens.access_token,
        access_expires_in: tokens.expires_in,
        refresh_token: tokens.refresh_token,
        refresh_expires_in: tokens.refresh_expires_in,
        tiktok_username: profile.username,
        tiktok_display_name: profile.display_name,
        tiktok_avatar_url: profile.avatar_url,
        access_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        refresh_expires_at: new Date(
          Date.now() + tokens.refresh_expires_in * 1000,
        ),
      },
    });
  }
  async getById(id: string) {
    const tikTokUser = await this.prisma.tikTokUser.findUnique({
      where: {
        id,
      },
    });
    if (!tikTokUser) throw new NotFoundException('Тик ток аккаунт не найден');

    return tikTokUser;
  }
  async getAllNotConnect() {
    return await this.prisma.tikTokUser.findMany({
      where: {
        moderatorId: null,
      },
    });
  }

  async updateAuthorContent(moderatorId: string, dto: updateAuthorContentDto) {
    const tikTokUser = await this.prisma.tikTokUser.update({
      where: {
        id: dto.tiktokUserId,
        moderatorId,
      },
      data: {
        isAuthorContent: dto.isAuthorContent,
      },
    });
    if (!tikTokUser)
      throw new ConflictException('Аккаунт не привязан к этому модератору');

    return {
      isAuthorContent: tikTokUser.isAuthorContent,
    };
  }

  async delete(adminId: string, tiktokUserId: string) {
    const admin = await this.moderatorService.getModeratorById(adminId);

    if (!admin.isAdmin)
      throw new UnauthorizedException(
        'У вас нет прав администратора для удаления аккаунта',
      );

    await this.getById(tiktokUserId);

    return this.prisma.tikTokUser.delete({
      where: {
        id: tiktokUserId,
      },
    });
  }
  async updateModerator(
    adminId: string,
    tiktokUserId: string,
    moderatorId: string | null,
  ) {
    const admin = await this.moderatorService.getModeratorById(adminId);

    if (!admin.isAdmin) {
      throw new UnauthorizedException(
        'У вас нет прав администратора для изменения модератора аккаунта',
      );
    }

    await this.getById(tiktokUserId);

    if (moderatorId) {
      await this.moderatorService.getModeratorById(moderatorId);
    }

    return this.prisma.tikTokUser.update({
      where: {
        id: tiktokUserId,
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
}
