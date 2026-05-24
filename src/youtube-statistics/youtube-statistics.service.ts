import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

export type YouTubeVideoStats = {
  id: string;
  title: string;
  video_description: string;
  duration: number;
  cover_image_url: string;
  share_url: string;
  create_time: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
};

export type YouTubeUserForStats = {
  id: string;
  access_token: string;
  access_expires_at: Date;
  refresh_token: string | null;
  youtube_channel_id: string;
  youtube_title: string | null;
};

type YouTubeThumbnail = {
  default?: { url?: string };
  medium?: { url?: string };
  high?: { url?: string };
  standard?: { url?: string };
  maxres?: { url?: string };
};

type YouTubeSearchListResponse = {
  nextPageToken?: string;
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
};

type YouTubeVideosListResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      publishedAt?: string;
      title?: string;
      description?: string;
      thumbnails?: YouTubeThumbnail;
    };
    contentDetails?: {
      duration?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
};

type GoogleRefreshTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class YoutubeStatisticsService {
  private readonly logger = new Logger(YoutubeStatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private toNumber(value: string | undefined) {
    return Number(value ?? 0);
  }

  private getBestThumbnail(thumbnails?: YouTubeThumbnail) {
    return (
      thumbnails?.maxres?.url ??
      thumbnails?.standard?.url ??
      thumbnails?.high?.url ??
      thumbnails?.medium?.url ??
      thumbnails?.default?.url ??
      ''
    );
  }

  private parseYoutubeDuration(duration: string | undefined) {
    if (!duration) return 0;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

    if (!match) return 0;

    return (
      Number(match[1] ?? 0) * 3600 +
      Number(match[2] ?? 0) * 60 +
      Number(match[3] ?? 0)
    );
  }

  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async refreshYouTubeAccessToken(user: YouTubeUserForStats) {
    if (!user.refresh_token) {
      await this.prisma.youTubeUser.update({
        where: { id: user.id },
        data: { isUpdate: true },
      });

      throw new BadRequestException(
        `У YouTube аккаунта ${user.youtube_title ?? user.id} отсутствует refresh_token. Нужно заново авторизовать YouTube.`,
      );
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
        refresh_token: user.refresh_token,
      }),
    });

    const data = (await response.json()) as GoogleRefreshTokenResponse;

    if (!response.ok || !data.access_token || !data.expires_in) {
      await this.prisma.youTubeUser.update({
        where: { id: user.id },
        data: { isUpdate: true },
      });

      this.logger.error(
        [
          'YouTube refresh token error',
          `accountId=${user.id}`,
          `channelId=${user.youtube_channel_id}`,
          `response=${JSON.stringify(data)}`,
        ].join(' | '),
      );

      throw new BadRequestException(
        `Не удалось обновить YouTube токен для канала ${
          user.youtube_title ?? user.id
        }. Нужно заново авторизовать YouTube.`,
      );
    }

    return this.prisma.youTubeUser.update({
      where: { id: user.id },
      data: {
        access_token: data.access_token,
        access_expires_in: data.expires_in,
        access_expires_at: new Date(Date.now() + data.expires_in * 1000),
        isUpdate: false,
      },
    });
  }

  private async getValidAccessToken(user: YouTubeUserForStats) {
    const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);

    if (user.access_expires_at > twoMinutesFromNow) {
      return user.access_token;
    }

    const updatedUser = await this.refreshYouTubeAccessToken(user);

    return updatedUser.access_token;
  }

  private async fetchWithRetry(
    url: string,
    accessToken: string,
    retryCount = 2,
  ) {
    for (let attempt = 1; attempt <= retryCount + 1; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (
          (response.status === 429 || response.status >= 500) &&
          attempt <= retryCount
        ) {
          await this.wait(attempt * 1000);
          continue;
        }

        return response;
      } catch (error) {
        if (attempt <= retryCount) {
          await this.wait(attempt * 1000);
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException('YouTube API временно недоступен');
  }

  private async fetchWithAutoRefresh(url: string, user: YouTubeUserForStats) {
    let accessToken = await this.getValidAccessToken(user);

    let response = await this.fetchWithRetry(url, accessToken);

    if (response.status !== 401) {
      return response;
    }

    const updatedUser = await this.refreshYouTubeAccessToken(user);
    accessToken = updatedUser.access_token;

    response = await this.fetchWithRetry(url, accessToken);

    return response;
  }

  private async getVideoIdsByChannelForDateRange(
    user: YouTubeUserForStats,
    start: Date,
    end: Date,
  ) {
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    while (true) {
      const params = new URLSearchParams({
        part: 'snippet',
        channelId: user.youtube_channel_id,
        type: 'video',
        order: 'date',
        maxResults: '50',
        publishedAfter: start.toISOString(),
        publishedBefore: end.toISOString(),
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

      const response = await this.fetchWithAutoRefresh(url, user);
      const json = (await response.json()) as YouTubeSearchListResponse;

      if (!response.ok) {
        this.logger.error(
          [
            'YouTube search.list error',
            `accountId=${user.id}`,
            `channelId=${user.youtube_channel_id}`,
            `status=${response.status}`,
            `response=${JSON.stringify(json)}`,
          ].join(' | '),
        );

        throw new BadRequestException(
          `YouTube API вернул ошибку ${response.status} для канала ${
            user.youtube_title ?? user.id
          }`,
        );
      }

      const ids =
        json.items
          ?.map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id)) ?? [];

      videoIds.push(...ids);

      if (!json.nextPageToken) break;

      pageToken = json.nextPageToken;
    }

    return [...new Set(videoIds)];
  }

  private async getVideosStatisticsByIds(
    user: YouTubeUserForStats,
    videoIds: string[],
  ): Promise<YouTubeVideoStats[]> {
    if (videoIds.length === 0) return [];

    const result: YouTubeVideoStats[] = [];

    for (let i = 0; i < videoIds.length; i += 50) {
      const idsBatch = videoIds.slice(i, i + 50);

      const params = new URLSearchParams({
        part: 'snippet,contentDetails,statistics',
        id: idsBatch.join(','),
      });

      const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;

      const response = await this.fetchWithAutoRefresh(url, user);
      const json = (await response.json()) as YouTubeVideosListResponse;

      if (!response.ok) {
        this.logger.error(
          [
            'YouTube videos.list error',
            `accountId=${user.id}`,
            `channelId=${user.youtube_channel_id}`,
            `status=${response.status}`,
            `response=${JSON.stringify(json)}`,
          ].join(' | '),
        );

        throw new BadRequestException(
          `YouTube API вернул ошибку ${response.status} для канала ${
            user.youtube_title ?? user.id
          }`,
        );
      }

      const videos =
        json.items?.map((video) => {
          const publishedAt = video.snippet?.publishedAt
            ? new Date(video.snippet.publishedAt)
            : new Date();

          return {
            id: video.id,
            title: video.snippet?.title ?? '',
            video_description: video.snippet?.description ?? '',
            duration: this.parseYoutubeDuration(video.contentDetails?.duration),
            cover_image_url: this.getBestThumbnail(video.snippet?.thumbnails),
            share_url: `https://www.youtube.com/watch?v=${video.id}`,
            create_time: Math.floor(publishedAt.getTime() / 1000),
            view_count: this.toNumber(video.statistics?.viewCount),
            like_count: this.toNumber(video.statistics?.likeCount),
            comment_count: this.toNumber(video.statistics?.commentCount),
            share_count: 0,
          };
        }) ?? [];

      result.push(...videos);
    }

    return result;
  }

  async getVideosByChannelForDateRange(
    user: YouTubeUserForStats,
    start: Date,
    end: Date,
  ) {
    try {
      const videoIds = await this.getVideoIdsByChannelForDateRange(
        user,
        start,
        end,
      );

      return this.getVideosStatisticsByIds(user, videoIds);
    } catch (error) {
      this.logger.error(
        [
          'Ошибка получения YouTube статистики',
          `accountId=${user.id}`,
          `channelId=${user.youtube_channel_id}`,
          `title=${user.youtube_title ?? 'unknown'}`,
          `message=${error instanceof Error ? error.message : 'unknown error'}`,
        ].join(' | '),
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}
