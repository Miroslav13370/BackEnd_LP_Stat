import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type InstagramProfile = {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

type AddUpdateInstagramUserDto = {
  facebookPageId: string;
  facebookPageName: string;
  instagramAccountId: string;
  pageAccessToken: string;
  tokenType: string | null;
  expiresIn: number | null;
  profile: InstagramProfile;
};

@Injectable()
export class InstagramUserService {
  constructor(private readonly prisma: PrismaService) {}

  async addUpdateUser(dto: AddUpdateInstagramUserDto) {
    return this.prisma.instagramUserOld.upsert({
      where: {
        instagram_account_id: dto.instagramAccountId,
      },
      update: {
        facebook_page_id: dto.facebookPageId,
        facebook_page_name: dto.facebookPageName,

        access_token: dto.pageAccessToken,
        token_type: dto.tokenType,

        access_expires_in: dto.expiresIn,
        access_expires_at: dto.expiresIn
          ? new Date(Date.now() + dto.expiresIn * 1000)
          : null,

        instagram_username: dto.profile.username ?? null,
        instagram_name: dto.profile.name ?? null,
        instagram_biography: dto.profile.biography ?? null,
        instagram_profile_picture_url: dto.profile.profile_picture_url ?? null,

        followers_count: dto.profile.followers_count ?? 0,
        follows_count: dto.profile.follows_count ?? 0,
        media_count: dto.profile.media_count ?? 0,

        isUpdate: false,
      },
      create: {
        facebook_page_id: dto.facebookPageId,
        facebook_page_name: dto.facebookPageName,

        instagram_account_id: dto.instagramAccountId,

        access_token: dto.pageAccessToken,
        token_type: dto.tokenType,

        access_expires_in: dto.expiresIn,
        access_expires_at: dto.expiresIn
          ? new Date(Date.now() + dto.expiresIn * 1000)
          : null,

        instagram_username: dto.profile.username ?? null,
        instagram_name: dto.profile.name ?? null,
        instagram_biography: dto.profile.biography ?? null,
        instagram_profile_picture_url: dto.profile.profile_picture_url ?? null,

        followers_count: dto.profile.followers_count ?? 0,
        follows_count: dto.profile.follows_count ?? 0,
        media_count: dto.profile.media_count ?? 0,
      },
    });
  }
  getAll() {
    return this.prisma.instagramUserOld.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }
}
