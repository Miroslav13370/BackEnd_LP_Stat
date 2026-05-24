import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InstagramReportStatus, Prisma } from 'prisma/generated/prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import {
  TikTokVideo,
  TikTokVideosResponse,
} from 'src/types/tikTokTokenResponse.type';
import {
  YoutubeStatisticsService,
  YouTubeUserForStats,
} from 'src/youtube-statistics/youtube-statistics.service';

import {
  StatisticsPeriodDto,
  StatisticsPeriodType,
} from './dto/statistics-period.dto';

type SocialPlatform = 'tiktok' | 'youtube' | 'instagram';

type SocialAccountWithVideos = {
  id: string;
  platform: SocialPlatform;
  openId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  moderatorId: string | null;
  isAuthorContent: boolean;
  planTarget: number;
  videos: TikTokVideo[];
  error: string | null;

  statsViewsCount?: number;
  statsLikesCount?: number;
  statsVideosCount?: number;
};

type TikTokUserForStats = {
  id: string;
  tiktok_open_id: string;
  access_token: string;
  tiktok_username: string | null;
  tiktok_display_name: string | null;
  tiktok_avatar_url: string | null;
  isAuthorContent: boolean;
  planTarget: number;
  moderatorId: string | null;
};

type YouTubeUserForStatsFull = YouTubeUserForStats & {
  access_expires_at: Date;
  youtube_description?: string | null;
  youtube_custom_url?: string | null;
  youtube_thumbnail_url?: string | null;
  isAuthorContent: boolean;
  planTarget: number;
  moderatorId: string | null;
};

type InstagramAccountForStats = {
  id: string;
  username: string;
  accountUrl: string;
  avatarUrl: string | null;
  isAuthorContent: boolean;
  planTarget: number;
  moderatorId: string | null;
};

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtubeStatisticsService: YoutubeStatisticsService,
  ) {}

  private readonly fullCuratorSalary = 20_000;
  private readonly curatorSalaryViewsLimit = 1_000_000;
  private readonly curatorSalaryViewRate = 0.02;

  private readonly weeklyTopVideoRate = 0.02;
  private readonly monthTopVideoRate = 0.02;
  private readonly dePremiumRate = 0.01;

  private readonly accountsBatchSize = 3;
  private readonly delayBetweenAccountBatchesMs = 1_500;
  private readonly delayBetweenTikTokPagesMs = 250;
  private readonly tikTokMaxAttempts = 4;
  private readonly tikTokMaxPagesPerAccount = 80;

  private readonly refreshLocks = new Map<string, Promise<unknown>>();

  private round(value: number) {
    return Math.round(value);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getLockKey(type: string, ownerId: string, start: Date, end: Date) {
    return `${type}:${ownerId}:${start.toISOString()}:${end.toISOString()}`;
  }

  private async runWithLock<T>(key: string, callback: () => Promise<T>) {
    const exists = this.refreshLocks.get(key);

    if (exists) {
      return (await exists) as T;
    }

    const promise = callback();

    this.refreshLocks.set(key, promise);

    try {
      return await promise;
    } finally {
      this.refreshLocks.delete(key);
    }
  }

  private getTotalViews(videos: TikTokVideo[]) {
    return videos.reduce((sum, video) => sum + video.view_count, 0);
  }

  private getTotalLikes(videos: TikTokVideo[]) {
    return videos.reduce((sum, video) => sum + video.like_count, 0);
  }

  private getVideosWithMinViews(videos: TikTokVideo[], minViews: number) {
    return videos.filter((video) => video.view_count >= minViews);
  }

  private getCuratorSalary(totalViews: number) {
    if (totalViews >= this.curatorSalaryViewsLimit) {
      return this.fullCuratorSalary;
    }

    return this.round(totalViews * this.curatorSalaryViewRate);
  }

  private getPlanByStats(totalViews: number, videosFrom1k: number) {
    if (videosFrom1k >= 75 || totalViews > 1_000_000) {
      return {
        plan: 30_000,
        label: 'План 30к',
        isCompleted: true,
      };
    }

    if (videosFrom1k >= 60 || totalViews > 1_000_000) {
      return {
        plan: 20_000,
        label: 'План 20к',
        isCompleted: true,
      };
    }

    if (videosFrom1k >= 30 || totalViews > 200_000) {
      return {
        plan: 10_000,
        label: 'План 10к',
        isCompleted: true,
      };
    }

    return {
      plan: 0,
      label: 'План не выполнен',
      isCompleted: false,
    };
  }

  private getPlanByAccount(videos: TikTokVideo[]) {
    const totalViews = this.getTotalViews(videos);
    const videosFrom1k = this.getVideosWithMinViews(videos, 1_000).length;

    return this.getPlanByStats(totalViews, videosFrom1k);
  }

  private isValidDateString(date: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  private parseDateStrict(date: string) {
    if (!this.isValidDateString(date)) {
      throw new BadRequestException('Дата должна быть в формате YYYY-MM-DD');
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Некорректная дата');
    }

    if (parsedDate.getUTCFullYear() < 2020) {
      throw new BadRequestException('Год не может быть меньше 2020');
    }

    return parsedDate;
  }

  private startOfDay(date: Date) {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  }

  private addDays(date: Date, days: number) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

  private getDateOnly(date: Date) {
    return date.toISOString().split('T')[0];
  }

  private getPeriodRange(query: StatisticsPeriodDto) {
    const now = new Date();

    if (query.periodType === StatisticsPeriodType.DAY) {
      const start = this.startOfDay(now);
      const end = this.addDays(start, 1);

      return {
        start,
        end,
        label: 'День',
        periodType: query.periodType,
      };
    }

    if (query.periodType === StatisticsPeriodType.MONTH) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        start,
        end,
        label: 'Месяц',
        periodType: query.periodType,
      };
    }

    if (query.periodType === StatisticsPeriodType.ALL) {
      return {
        start: new Date('2005-01-01T00:00:00.000Z'),
        end: now,
        label: 'Всё время',
        periodType: query.periodType,
      };
    }

    if (!query.startDate || !query.endDate) {
      throw new BadRequestException(
        'Для произвольного периода startDate и endDate обязательны',
      );
    }

    const start = this.parseDateStrict(query.startDate);
    const end = this.addDays(this.parseDateStrict(query.endDate), 1);

    if (start >= end) {
      throw new BadRequestException('startDate должен быть раньше endDate');
    }

    if (start > now) {
      throw new BadRequestException('startDate не может быть в будущем');
    }

    return {
      start,
      end,
      label: `${query.startDate} — ${query.endDate}`,
      periodType: query.periodType,
    };
  }

  private validateDateRange(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate и endDate обязательны');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Некорректный диапазон дат');
    }

    if (start >= end) {
      throw new BadRequestException('startDate должен быть раньше endDate');
    }

    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays > 31) {
      throw new BadRequestException('Диапазон не должен быть больше 31 дня');
    }

    return {
      start,
      end,
    };
  }

  private async getCachedStatistics<T>({
    type,
    ownerId,
    start,
    end,
  }: {
    type: string;
    ownerId: string;
    start: Date;
    end: Date;
  }): Promise<T | null> {
    const cache = await this.prisma.statisticsCache.findUnique({
      where: {
        type_ownerId_startDate_endDate: {
          type,
          ownerId,
          startDate: start,
          endDate: end,
        },
      },
    });

    return (cache?.data as T) ?? null;
  }

  private async saveCachedStatistics<T>({
    type,
    ownerId,
    start,
    end,
    data,
  }: {
    type: string;
    ownerId: string;
    start: Date;
    end: Date;
    data: T;
  }) {
    const jsonData = data as unknown as Prisma.InputJsonValue;

    await this.prisma.statisticsCache.upsert({
      where: {
        type_ownerId_startDate_endDate: {
          type,
          ownerId,
          startDate: start,
          endDate: end,
        },
      },
      update: {
        data: jsonData,
      },
      create: {
        type,
        ownerId,
        startDate: start,
        endDate: end,
        data: jsonData,
      },
    });
  }

  private getTopVideosByWeek(
    accounts: SocialAccountWithVideos[],
    start: Date,
    end: Date,
  ) {
    const allVideos = accounts.flatMap((account) =>
      account.videos.map((video) => ({
        ...video,
        platform: account.platform,
        accountId: account.id,
        username: account.username,
        displayName: account.displayName,
      })),
    );

    const weeksCount = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7),
    );

    const result: Array<{
      week: number;
      weekStartDate: string;
      weekEndDate: string;
      label: string;
      video: TikTokVideo & {
        platform: SocialPlatform;
        accountId: string;
        username: string | null;
        displayName: string | null;
      };
      bonus: number;
    }> = [];

    for (let week = 1; week <= weeksCount; week++) {
      const weekStart = this.addDays(start, (week - 1) * 7);
      const weekEndExclusive = this.addDays(weekStart, 7);

      const realWeekEndExclusive =
        weekEndExclusive > end ? end : weekEndExclusive;

      const videosByWeek = allVideos.filter((video) => {
        const videoDate = new Date(video.create_time * 1000);

        return videoDate >= weekStart && videoDate < realWeekEndExclusive;
      });

      const topVideo = videosByWeek.sort(
        (a, b) => b.view_count - a.view_count,
      )[0];

      if (!topVideo) continue;

      const weekEndInclusive = this.addDays(realWeekEndExclusive, -1);

      const weekStartLabel = this.getDateOnly(weekStart);
      const weekEndLabel = this.getDateOnly(weekEndInclusive);

      result.push({
        week,
        weekStartDate: weekStartLabel,
        weekEndDate: weekEndLabel,
        label: `${weekStartLabel} — ${weekEndLabel}`,
        video: topVideo,
        bonus: this.round(topVideo.view_count * this.weeklyTopVideoRate),
      });
    }

    return result;
  }

  private getTopVideosByRange(accounts: SocialAccountWithVideos[]) {
    return accounts
      .flatMap((account) =>
        account.videos.map((video) => ({
          ...video,
          platform: account.platform,
          accountId: account.id,
          username: account.username,
          displayName: account.displayName,
          bonus: this.round(video.view_count * this.monthTopVideoRate),
        })),
      )
      .filter((video) => video.view_count >= 100_000)
      .sort((a, b) => b.view_count - a.view_count);
  }

  private getRetryDelayMs(response: Response, attempt: number) {
    const retryAfter = response.headers.get('retry-after');

    if (retryAfter) {
      const retryAfterSeconds = Number(retryAfter);

      if (!Number.isNaN(retryAfterSeconds)) {
        return retryAfterSeconds * 1000;
      }
    }

    return attempt * 2_000;
  }

  private async fetchTikTokVideosPage({
    user,
    cursor,
  }: {
    user: {
      id: string;
      access_token: string;
      tiktok_username: string | null;
    };
    cursor: number;
  }) {
    const url =
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count';

    for (let attempt = 1; attempt <= this.tikTokMaxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            max_count: 20,
            cursor,
          }),
        });

        if (response.status === 429 && attempt < this.tikTokMaxAttempts) {
          const delayMs = this.getRetryDelayMs(response, attempt);

          this.logger.warn(
            [
              'TikTok API rate limit',
              `attempt=${attempt}/${this.tikTokMaxAttempts}`,
              `accountId=${user.id}`,
              `username=${user.tiktok_username ?? 'null'}`,
              `cursor=${cursor}`,
              `delayMs=${delayMs}`,
            ].join(' | '),
          );

          await this.sleep(delayMs);
          continue;
        }

        return response;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Неизвестная fetch ошибка';

        this.logger.warn(
          [
            'Повтор TikTok API запроса после сетевой ошибки',
            `attempt=${attempt}/${this.tikTokMaxAttempts}`,
            `accountId=${user.id}`,
            `username=${user.tiktok_username ?? 'null'}`,
            `cursor=${cursor}`,
            `message=${message}`,
          ].join(' | '),
        );

        if (attempt === this.tikTokMaxAttempts) {
          throw error;
        }

        await this.sleep(attempt * 2_000);
      }
    }

    throw new BadRequestException('Не удалось выполнить запрос к TikTok API');
  }

  private async getListVideoByUserForDateRange(
    user: {
      id: string;
      access_token: string;
      tiktok_username: string | null;
    },
    start: Date,
    end: Date,
  ) {
    const videosForRange: TikTokVideo[] = [];

    let cursor = 0;
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      page++;

      if (page > this.tikTokMaxPagesPerAccount) {
        this.logger.warn(
          [
            'Остановили TikTok pagination по лимиту страниц',
            `accountId=${user.id}`,
            `username=${user.tiktok_username ?? 'null'}`,
            `maxPages=${this.tikTokMaxPagesPerAccount}`,
          ].join(' | '),
        );

        break;
      }

      const response = await this.fetchTikTokVideosPage({
        user,
        cursor,
      });

      if (!response.ok) {
        const errorText = await response.text();

        this.logger.error(
          [
            'TikTok API вернул ошибку',
            `status=${response.status}`,
            `accountId=${user.id}`,
            `username=${user.tiktok_username ?? 'null'}`,
            `cursor=${cursor}`,
            `response=${errorText}`,
          ].join(' | '),
        );

        throw new BadRequestException(
          `TikTok API вернул ошибку ${response.status} для аккаунта ${
            user.tiktok_username ?? user.id
          }`,
        );
      }

      const json = (await response.json()) as TikTokVideosResponse;
      const videos = json.data?.videos ?? [];

      videosForRange.push(
        ...videos.filter((video) => {
          const videoDate = new Date(video.create_time * 1000);

          return videoDate >= start && videoDate < end;
        }),
      );

      const hasOldVideo = videos.some((video) => {
        const videoDate = new Date(video.create_time * 1000);

        return videoDate < start;
      });

      if (hasOldVideo) {
        break;
      }

      cursor = json.data?.cursor ?? 0;
      hasMore = json.data?.has_more ?? false;

      if (hasMore) {
        await this.sleep(this.delayBetweenTikTokPagesMs);
      }
    }

    return videosForRange;
  }

  async getListVideoByUserOpenIdForDateRange(
    openId: string,
    start: Date,
    end: Date,
  ) {
    const user = await this.prisma.tikTokUser.findUnique({
      where: {
        tiktok_open_id: openId,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.getListVideoByUserForDateRange(user, start, end);
  }

  private async getTikTokAccountWithVideos(
    user: TikTokUserForStats,
    start: Date,
    end: Date,
  ): Promise<SocialAccountWithVideos> {
    try {
      const videos = await this.getListVideoByUserForDateRange(
        user,
        start,
        end,
      );

      return {
        id: user.id,
        platform: 'tiktok',
        openId: user.tiktok_open_id,
        username: user.tiktok_username,
        displayName: user.tiktok_display_name,
        avatarUrl: user.tiktok_avatar_url,
        moderatorId: user.moderatorId,
        isAuthorContent: user.isAuthorContent,
        planTarget: user.planTarget,
        videos,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось получить статистику TikTok аккаунта';

      this.logger.error(message);

      return {
        id: user.id,
        platform: 'tiktok',
        openId: user.tiktok_open_id,
        username: user.tiktok_username,
        displayName: user.tiktok_display_name,
        avatarUrl: user.tiktok_avatar_url,
        moderatorId: user.moderatorId,
        isAuthorContent: user.isAuthorContent,
        planTarget: user.planTarget,
        videos: [],
        error: message,
      };
    }
  }

  private async getYouTubeAccountWithVideos(
    user: YouTubeUserForStatsFull,
    start: Date,
    end: Date,
  ): Promise<SocialAccountWithVideos> {
    try {
      const videos =
        await this.youtubeStatisticsService.getVideosByChannelForDateRange(
          user,
          start,
          end,
        );

      return {
        id: user.id,
        platform: 'youtube',
        openId: user.youtube_channel_id,
        username: user.youtube_custom_url ?? user.youtube_channel_id,
        displayName: user.youtube_title,
        avatarUrl: user.youtube_thumbnail_url ?? null,
        moderatorId: user.moderatorId,
        isAuthorContent: user.isAuthorContent,
        planTarget: user.planTarget,
        videos,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось получить статистику YouTube аккаунта';

      this.logger.error(message);

      return {
        id: user.id,
        platform: 'youtube',
        openId: user.youtube_channel_id,
        username: user.youtube_custom_url ?? user.youtube_channel_id,
        displayName: user.youtube_title,
        avatarUrl: user.youtube_thumbnail_url ?? null,
        moderatorId: user.moderatorId,
        isAuthorContent: user.isAuthorContent,
        planTarget: user.planTarget,
        videos: [],
        error: message,
      };
    }
  }

  private makeInstagramViralVideo({
    account,
    video,
  }: {
    account: InstagramAccountForStats;
    video: {
      url: string;
      views: number;
      likes: number;
      publishedAt: string;
      title?: string;
    };
  }): TikTokVideo {
    const createdTime = Math.floor(
      new Date(video.publishedAt).getTime() / 1000,
    );

    return {
      id: video.url,
      title: video.title ?? `Instagram video — @${account.username}`,
      video_description: video.url,
      duration: 0,
      cover_image_url: account.avatarUrl ?? '',
      share_url: video.url,
      create_time: createdTime,
      view_count: video.views,
      like_count: video.likes,
      comment_count: 0,
      share_count: 0,
    };
  }

  private async getInstagramAccountWithVideos(
    account: InstagramAccountForStats,
    start: Date,
    end: Date,
  ): Promise<SocialAccountWithVideos> {
    const metricsReports = await this.prisma.instagramMetricsReport.findMany({
      where: {
        instagramAccountId: account.id,
        status: InstagramReportStatus.VERIFIED,
        OR: [
          {
            weekStartDate: {
              gte: start,
              lt: end,
            },
          },
          {
            startDate: {
              gte: start,
              lt: end,
            },
          },
        ],
      },
    });

    const viralReports = await this.prisma.instagramViralVideosReport.findMany({
      where: {
        instagramAccountId: account.id,
        status: InstagramReportStatus.VERIFIED,
        OR: [
          {
            weekStartDate: {
              gte: start,
              lt: end,
            },
          },
          {
            startDate: {
              gte: start,
              lt: end,
            },
          },
        ],
      },
    });

    const statsViewsCount = metricsReports.reduce((sum, report) => {
      return sum + report.viewsDelta;
    }, 0);

    const statsLikesCount = metricsReports.reduce((sum, report) => {
      return sum + report.likesDelta;
    }, 0);

    const statsVideosCount = metricsReports.reduce((sum, report) => {
      return sum + report.videosDelta;
    }, 0);

    const viralVideos = viralReports.flatMap((report) => {
      const videos = report.videos;

      if (!Array.isArray(videos)) return [];

      return videos as Array<{
        url: string;
        views: number;
        likes: number;
        publishedAt: string;
        title?: string;
      }>;
    });

    const videos = viralVideos.map((video) =>
      this.makeInstagramViralVideo({
        account,
        video,
      }),
    );

    return {
      id: account.id,
      platform: 'instagram',
      openId: account.id,
      username: account.username,
      displayName: account.username,
      avatarUrl: account.avatarUrl,
      moderatorId: account.moderatorId,
      isAuthorContent: account.isAuthorContent,
      planTarget: account.planTarget,
      videos,
      error: null,
      statsViewsCount,
      statsLikesCount,
      statsVideosCount,
    };
  }

  private async getTikTokAccountsWithVideos(
    users: TikTokUserForStats[],
    start: Date,
    end: Date,
  ) {
    const result: SocialAccountWithVideos[] = [];

    for (let i = 0; i < users.length; i += this.accountsBatchSize) {
      const batch = users.slice(i, i + this.accountsBatchSize);

      const batchResult = await Promise.all(
        batch.map((user) => this.getTikTokAccountWithVideos(user, start, end)),
      );

      result.push(...batchResult);

      if (i + this.accountsBatchSize < users.length) {
        await this.sleep(this.delayBetweenAccountBatchesMs);
      }
    }

    return result;
  }

  private async getYouTubeAccountsWithVideos(
    users: YouTubeUserForStatsFull[],
    start: Date,
    end: Date,
  ) {
    const result: SocialAccountWithVideos[] = [];

    for (let i = 0; i < users.length; i += this.accountsBatchSize) {
      const batch = users.slice(i, i + this.accountsBatchSize);

      const batchResult = await Promise.all(
        batch.map((user) => this.getYouTubeAccountWithVideos(user, start, end)),
      );

      result.push(...batchResult);

      if (i + this.accountsBatchSize < users.length) {
        await this.sleep(this.delayBetweenAccountBatchesMs);
      }
    }

    return result;
  }

  private async getInstagramAccountsWithVideos(
    accounts: InstagramAccountForStats[],
    start: Date,
    end: Date,
  ) {
    return Promise.all(
      accounts.map((account) =>
        this.getInstagramAccountWithVideos(account, start, end),
      ),
    );
  }

  private async getSocialAccountsWithVideos({
    tikTokUsers,
    youTubeUsers,
    instagramAccounts,
    start,
    end,
  }: {
    tikTokUsers: TikTokUserForStats[];
    youTubeUsers: YouTubeUserForStatsFull[];
    instagramAccounts: InstagramAccountForStats[];
    start: Date;
    end: Date;
  }) {
    const [tikTokAccounts, youTubeAccounts, instagramAccountsWithVideos] =
      await Promise.all([
        this.getTikTokAccountsWithVideos(tikTokUsers, start, end),
        this.getYouTubeAccountsWithVideos(youTubeUsers, start, end),
        this.getInstagramAccountsWithVideos(instagramAccounts, start, end),
      ]);

    return [
      ...tikTokAccounts,
      ...youTubeAccounts,
      ...instagramAccountsWithVideos,
    ];
  }

  private buildAccountStats(accounts: SocialAccountWithVideos[]) {
    return accounts.map((account) => {
      const totalViews =
        account.statsViewsCount ?? this.getTotalViews(account.videos);
      const totalLikes =
        account.statsLikesCount ?? this.getTotalLikes(account.videos);
      const videosCount = account.statsVideosCount ?? account.videos.length;

      const videosFrom1kCount = this.getVideosWithMinViews(
        account.videos,
        1_000,
      ).length;

      const plan =
        account.platform === 'instagram'
          ? this.getPlanByStats(totalViews, videosFrom1kCount)
          : this.getPlanByAccount(account.videos);

      const dePremium = account.isAuthorContent
        ? 0
        : this.round(totalViews * this.dePremiumRate * -1);

      const bestVideo = [...account.videos].sort(
        (a, b) => b.view_count - a.view_count,
      )[0];

      return {
        id: account.id,
        platform: account.platform,
        openId: account.openId,
        username: account.username,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        moderatorId: account.moderatorId,
        isAuthorContent: account.isAuthorContent,
        videosCount,
        likesCount: totalLikes,
        viewsCount: totalViews,
        videosFrom1kCount,
        plan,
        dePremium,
        bestVideo: bestVideo ?? null,
        error: account.error,
      };
    });
  }

  private buildModeratorStatistics(
    accountsWithVideos: SocialAccountWithVideos[],
    start: Date,
    end: Date,
  ) {
    const accountStats = this.buildAccountStats(accountsWithVideos);

    const totalViews = accountStats.reduce((sum, account) => {
      return sum + account.viewsCount;
    }, 0);

    const curatorSalary = this.getCuratorSalary(totalViews);

    const planBonus = accountStats.reduce((sum, account) => {
      return sum + account.plan.plan;
    }, 0);

    const dePremium = accountStats.reduce((sum, account) => {
      return sum + account.dePremium;
    }, 0);

    const weeklyTopVideos = this.getTopVideosByWeek(
      accountsWithVideos,
      start,
      end,
    );

    const weeklyTopVideosBonus = weeklyTopVideos.reduce((sum, item) => {
      return sum + item.bonus;
    }, 0);

    const monthlyTopVideos = this.getTopVideosByRange(accountsWithVideos);

    const monthlyTopVideosBonus = monthlyTopVideos.reduce((sum, video) => {
      return sum + video.bonus;
    }, 0);

    const bonusesTotal =
      planBonus + weeklyTopVideosBonus + monthlyTopVideosBonus;

    const curatorTotal = curatorSalary + bonusesTotal + dePremium;

    return {
      summary: {
        salary: this.round(curatorSalary),
        planBonus: this.round(planBonus),
        weeklyTopVideosBonus: this.round(weeklyTopVideosBonus),
        monthlyTopVideosBonus: this.round(monthlyTopVideosBonus),
        bonusesTotal: this.round(bonusesTotal),
        dePremium: this.round(dePremium),
        totalViews: this.round(totalViews),
        curatorTotal: this.round(curatorTotal),
      },
      accounts: accountStats,
      weeklyTopVideos,
      monthlyTopVideos,
    };
  }

  private async calculateModeratorStatisticsByDateRange(
    moderatorId: string,
    startDate: string,
    endDate: string,
  ) {
    const { start, end } = this.validateDateRange(startDate, endDate);

    const moderator = await this.prisma.moderator.findUnique({
      where: {
        id: moderatorId,
      },
      include: {
        tikTokUser: true,
        youTubeUser: true,
        instagramAccounts: true,
      },
    });

    if (!moderator) {
      throw new NotFoundException('Модератор не найден');
    }

    const accountsWithVideos = await this.getSocialAccountsWithVideos({
      tikTokUsers: moderator.tikTokUser,
      youTubeUsers: moderator.youTubeUser,
      instagramAccounts: moderator.instagramAccounts,
      start,
      end,
    });

    const statistics = this.buildModeratorStatistics(
      accountsWithVideos,
      start,
      end,
    );

    return {
      period: {
        startDate,
        endDate,
      },
      moderator: {
        id: moderator.id,
        login: moderator.login,
      },
      summary: statistics.summary,
      accounts: statistics.accounts,
      weeklyTopVideos: statistics.weeklyTopVideos,
      monthlyTopVideos: statistics.monthlyTopVideos,
    };
  }

  async getModeratorStatisticsByDateRange(
    moderatorId: string,
    startDate: string,
    endDate: string,
    forceRefresh = false,
  ) {
    const { start, end } = this.validateDateRange(startDate, endDate);
    const lockKey = this.getLockKey('moderator', moderatorId, start, end);

    if (!forceRefresh) {
      const cached = await this.getCachedStatistics({
        type: 'moderator',
        ownerId: moderatorId,
        start,
        end,
      });

      if (cached) return cached;
    }

    return this.runWithLock(lockKey, async () => {
      const freshData = await this.calculateModeratorStatisticsByDateRange(
        moderatorId,
        startDate,
        endDate,
      );

      await this.saveCachedStatistics({
        type: 'moderator',
        ownerId: moderatorId,
        start,
        end,
        data: freshData,
      });

      return freshData;
    });
  }

  async getTikTokUserStatisticsByDateRange(
    id: string,
    startDate: string,
    endDate: string,
    forceRefresh = false,
  ) {
    const { start, end } = this.validateDateRange(startDate, endDate);
    const lockKey = this.getLockKey('tiktok-user', id, start, end);

    if (!forceRefresh) {
      const cached = await this.getCachedStatistics({
        type: 'tiktok-user',
        ownerId: id,
        start,
        end,
      });

      if (cached) return cached;
    }

    return this.runWithLock(lockKey, async () => {
      const user = await this.prisma.tikTokUser.findUnique({
        where: { id },
        include: {
          moderator: {
            select: {
              id: true,
              login: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('Тик ток аккаунт не найден');
      }

      const videos = await this.getListVideoByUserForDateRange(
        user,
        start,
        end,
      );

      const accountsWithVideos: SocialAccountWithVideos[] = [
        {
          id: user.id,
          platform: 'tiktok',
          openId: user.tiktok_open_id,
          username: user.tiktok_username,
          displayName: user.tiktok_display_name,
          avatarUrl: user.tiktok_avatar_url,
          moderatorId: user.moderatorId,
          isAuthorContent: user.isAuthorContent,
          planTarget: user.planTarget,
          videos,
          error: null,
        },
      ];

      const [accountStats] = this.buildAccountStats(accountsWithVideos);

      const result = {
        account: {
          ...accountStats,
          moderator: user.moderator,
        },
        videos: [...videos].sort((a, b) => b.view_count - a.view_count),
      };

      await this.saveCachedStatistics({
        type: 'tiktok-user',
        ownerId: id,
        start,
        end,
        data: result,
      });

      return result;
    });
  }

  async getAdminTikTokUsersStatistics(query: StatisticsPeriodDto) {
    const period = this.getPeriodRange(query);
    const lockKey = this.getLockKey(
      'admin-social-accounts',
      'global',
      period.start,
      period.end,
    );

    if (!query.forceRefresh) {
      const cached = await this.getCachedStatistics({
        type: 'admin-social-accounts',
        ownerId: 'global',
        start: period.start,
        end: period.end,
      });

      if (cached) return cached;
    }

    return this.runWithLock(lockKey, async () => {
      const [tikTokUsers, youTubeUsers, instagramAccounts] = await Promise.all([
        this.prisma.tikTokUser.findMany({
          include: {
            moderator: {
              select: {
                id: true,
                login: true,
              },
            },
          },
        }),
        this.prisma.youTubeUser.findMany({
          include: {
            moderator: {
              select: {
                id: true,
                login: true,
              },
            },
          },
        }),
        this.prisma.instagramAccount.findMany({
          include: {
            moderator: {
              select: {
                id: true,
                login: true,
              },
            },
            editor: {
              select: {
                id: true,
                login: true,
              },
            },
          },
        }),
      ]);

      const accountsWithVideos = await this.getSocialAccountsWithVideos({
        tikTokUsers,
        youTubeUsers,
        instagramAccounts,
        start: period.start,
        end: period.end,
      });

      const accounts = this.buildAccountStats(accountsWithVideos)
        .map((account) => {
          if (account.platform === 'tiktok') {
            const user = tikTokUsers.find((item) => item.id === account.id);

            return {
              ...account,
              moderator: user?.moderator ?? null,
            };
          }

          if (account.platform === 'youtube') {
            const user = youTubeUsers.find((item) => item.id === account.id);

            return {
              ...account,
              moderator: user?.moderator ?? null,
            };
          }

          const user = instagramAccounts.find((item) => item.id === account.id);

          return {
            ...account,
            moderator: user?.moderator ?? null,
            editor: user?.editor ?? null,
          };
        })
        .sort((a, b) => b.viewsCount - a.viewsCount);

      const totalViews = accounts.reduce((sum, account) => {
        return sum + account.viewsCount;
      }, 0);

      const totalLikes = accounts.reduce((sum, account) => {
        return sum + account.likesCount;
      }, 0);

      const totalVideos = accounts.reduce((sum, account) => {
        return sum + account.videosCount;
      }, 0);

      const result = {
        period: {
          type: period.periodType,
          label: period.label,
          startDate: period.start,
          endDate: period.end,
        },
        summary: {
          accountsCount: accounts.length,
          totalViews: this.round(totalViews),
          totalLikes: this.round(totalLikes),
          totalVideos,
        },
        accounts,
      };

      await this.saveCachedStatistics({
        type: 'admin-social-accounts',
        ownerId: 'global',
        start: period.start,
        end: period.end,
        data: result,
      });

      return result;
    });
  }

  async getAdminModeratorsStatistics(query: StatisticsPeriodDto) {
    const period = this.getPeriodRange(query);
    const lockKey = this.getLockKey(
      'admin-moderators',
      'global',
      period.start,
      period.end,
    );

    if (!query.forceRefresh) {
      const cached = await this.getCachedStatistics({
        type: 'admin-moderators',
        ownerId: 'global',
        start: period.start,
        end: period.end,
      });

      if (cached) return cached;
    }

    return this.runWithLock(lockKey, async () => {
      type AdminAccountForModerator = {
        id: string;
        moderatorId: string | null;
        viewsCount: number;
        dePremium: number;
        plan: {
          plan: number;
        };
      };

      type AdminSocialStatisticsForModerator = {
        accounts: AdminAccountForModerator[];
      };

      const [moderators, socialStatistics] = await Promise.all([
        this.prisma.moderator.findMany(),
        this.getAdminTikTokUsersStatistics({
          ...query,
          forceRefresh: query.forceRefresh,
        }) as Promise<AdminSocialStatisticsForModerator>,
      ]);

      const accounts = socialStatistics.accounts;

      const moderatorsStats = moderators.map((moderator) => {
        const moderatorAccounts = accounts.filter((account) => {
          return account.moderatorId === moderator.id;
        });

        const totalViews = moderatorAccounts.reduce((sum, account) => {
          return sum + account.viewsCount;
        }, 0);

        const salary = this.getCuratorSalary(totalViews);

        const planBonus = moderatorAccounts.reduce((sum, account) => {
          return sum + account.plan.plan;
        }, 0);

        const dePremium = moderatorAccounts.reduce((sum, account) => {
          return sum + account.dePremium;
        }, 0);

        const bonusesTotal = planBonus;
        const curatorTotal = salary + bonusesTotal + dePremium;

        return {
          id: moderator.id,
          login: moderator.login,
          isAdmin: moderator.isAdmin,
          accountsCount: moderatorAccounts.length,
          summary: {
            salary: this.round(salary),
            planBonus: this.round(planBonus),
            weeklyTopVideosBonus: 0,
            monthlyTopVideosBonus: 0,
            bonusesTotal: this.round(bonusesTotal),
            dePremium: this.round(dePremium),
            totalViews: this.round(totalViews),
            curatorTotal: this.round(curatorTotal),
          },
        };
      });

      const totalViews = moderatorsStats.reduce((sum, moderator) => {
        return sum + moderator.summary.totalViews;
      }, 0);

      const result = {
        period: {
          type: period.periodType,
          label: period.label,
          startDate: period.start,
          endDate: period.end,
        },
        summary: {
          moderatorsCount: moderatorsStats.length,
          totalViews: this.round(totalViews),
        },
        moderators: moderatorsStats.sort(
          (a, b) => b.summary.totalViews - a.summary.totalViews,
        ),
      };

      await this.saveCachedStatistics({
        type: 'admin-moderators',
        ownerId: 'global',
        start: period.start,
        end: period.end,
        data: result,
      });

      return result;
    });
  }

  async getAdminModeratorStatisticsByPeriod(
    moderatorId: string,
    query: StatisticsPeriodDto,
  ) {
    const period = this.getPeriodRange(query);
    const lockKey = this.getLockKey(
      'admin-moderator',
      moderatorId,
      period.start,
      period.end,
    );

    if (!query.forceRefresh) {
      const cached = await this.getCachedStatistics({
        type: 'admin-moderator',
        ownerId: moderatorId,
        start: period.start,
        end: period.end,
      });

      if (cached) return cached;
    }

    return this.runWithLock(lockKey, async () => {
      const moderator = await this.prisma.moderator.findUnique({
        where: {
          id: moderatorId,
        },
        include: {
          tikTokUser: true,
          youTubeUser: true,
          instagramAccounts: true,
        },
      });

      if (!moderator) {
        throw new NotFoundException('Модератор не найден');
      }

      const accountsWithVideos = await this.getSocialAccountsWithVideos({
        tikTokUsers: moderator.tikTokUser,
        youTubeUsers: moderator.youTubeUser,
        instagramAccounts: moderator.instagramAccounts,
        start: period.start,
        end: period.end,
      });

      const statistics = this.buildModeratorStatistics(
        accountsWithVideos,
        period.start,
        period.end,
      );

      const result = {
        period: {
          type: period.periodType,
          label: period.label,
          startDate: period.start,
          endDate: period.end,
        },
        moderator: {
          id: moderator.id,
          login: moderator.login,
          isAdmin: moderator.isAdmin,
        },
        summary: statistics.summary,
        accounts: statistics.accounts,
        weeklyTopVideos: statistics.weeklyTopVideos,
        monthlyTopVideos: statistics.monthlyTopVideos,
      };

      await this.saveCachedStatistics({
        type: 'admin-moderator',
        ownerId: moderatorId,
        start: period.start,
        end: period.end,
        data: result,
      });

      return result;
    });
  }

  async getAdminTikTokUserStatisticsByPeriod(
    id: string,
    query: StatisticsPeriodDto,
  ) {
    const period = this.getPeriodRange(query);
    const lockKey = this.getLockKey(
      'admin-tiktok-user',
      id,
      period.start,
      period.end,
    );

    if (!query.forceRefresh) {
      const cached = await this.getCachedStatistics({
        type: 'admin-tiktok-user',
        ownerId: id,
        start: period.start,
        end: period.end,
      });

      if (cached) return cached;
    }

    return this.runWithLock(lockKey, async () => {
      const user = await this.prisma.tikTokUser.findUnique({
        where: {
          id,
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

      if (!user) {
        throw new NotFoundException('Тик ток аккаунт не найден');
      }

      const videos = await this.getListVideoByUserForDateRange(
        user,
        period.start,
        period.end,
      );

      const accountsWithVideos: SocialAccountWithVideos[] = [
        {
          id: user.id,
          platform: 'tiktok',
          openId: user.tiktok_open_id,
          username: user.tiktok_username,
          displayName: user.tiktok_display_name,
          avatarUrl: user.tiktok_avatar_url,
          moderatorId: user.moderatorId,
          isAuthorContent: user.isAuthorContent,
          planTarget: user.planTarget,
          videos,
          error: null,
        },
      ];

      const [accountStats] = this.buildAccountStats(accountsWithVideos);

      const result = {
        period: {
          type: period.periodType,
          label: period.label,
          startDate: period.start,
          endDate: period.end,
        },
        account: {
          ...accountStats,
          moderator: user.moderator,
        },
        videos: [...videos].sort((a, b) => b.view_count - a.view_count),
      };

      await this.saveCachedStatistics({
        type: 'admin-tiktok-user',
        ownerId: id,
        start: period.start,
        end: period.end,
        data: result,
      });

      return result;
    });
  }
}
