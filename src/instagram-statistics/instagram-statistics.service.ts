import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type InstagramMediaResponse = {
  data?: InstagramMedia[];
  paging?: {
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramInsightsResponse = {
  data?: Array<{
    name: string;
    values: Array<{
      value: number;
    }>;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

type InstagramVideoWithStats = InstagramMedia & {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  totalInteractions: number;
};

@Injectable()
export class InstagramStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly fullCuratorSalary = 20_000;
  private readonly curatorSalaryViewsLimit = 1_000_000;
  private readonly curatorSalaryViewRate = 0.02;

  private round(value: number) {
    return Math.round(value);
  }

  private getDateDaysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private getInsightValue(insights: InstagramInsightsResponse, name: string) {
    return (
      insights.data?.find((item) => item.name === name)?.values?.[0]?.value ?? 0
    );
  }

  private async getInstagramMedia(
    instagramAccountId: string,
    accessToken: string,
  ) {
    const fields = [
      'id',
      'caption',
      'media_type',
      'media_url',
      'permalink',
      'timestamp',
      'like_count',
      'comments_count',
    ].join(',');

    let url: string | undefined =
      `https://graph.facebook.com/v23.0/${instagramAccountId}/media?fields=${fields}&limit=100&access_token=${accessToken}`;

    const media: InstagramMedia[] = [];

    while (url) {
      const response = await fetch(url);

      const data = (await response.json()) as InstagramMediaResponse;

      if (!response.ok) {
        console.log('INSTAGRAM MEDIA ERROR:', data);
        break;
      }

      media.push(...(data.data ?? []));

      url = data.paging?.next;
    }

    return media;
  }

  private async getInstagramMediaInsights(
    mediaId: string,
    accessToken: string,
  ) {
    const metrics = [
      'views',
      'reach',
      'likes',
      'comments',
      'saved',
      'shares',
      'total_interactions',
      'plays',
    ].join(',');

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`,
    );

    const data = (await response.json()) as InstagramInsightsResponse;

    console.log(`INSTAGRAM INSIGHTS ${mediaId}:`, data);

    if (!response.ok) {
      return {
        views: 0,
        reach: 0,
        saved: 0,
        shares: 0,
        totalInteractions: 0,
      };
    }

    const views = this.getInsightValue(data, 'views');
    const plays = this.getInsightValue(data, 'plays');

    return {
      views: views || plays,
      reach: this.getInsightValue(data, 'reach'),
      saved: this.getInsightValue(data, 'saved'),
      shares: this.getInsightValue(data, 'shares'),
      totalInteractions: this.getInsightValue(data, 'total_interactions'),
    };
  }

  private async getVideosWithStats(
    instagramAccountId: string,
    accessToken: string,
  ): Promise<InstagramVideoWithStats[]> {
    const media = await this.getInstagramMedia(instagramAccountId, accessToken);

    const videos = media.filter((item) => item.media_type === 'VIDEO');

    const result = await Promise.all(
      videos.map(async (video) => {
        const insights = await this.getInstagramMediaInsights(
          video.id,
          accessToken,
        );

        return {
          ...video,
          views: insights.views,
          reach: insights.reach,
          likes: video.like_count ?? 0,
          comments: video.comments_count ?? 0,
          saved: insights.saved,
          shares: insights.shares,
          totalInteractions: insights.totalInteractions,
        };
      }),
    );

    return result;
  }

  private getTotalViews(videos: InstagramVideoWithStats[]) {
    return videos.reduce((sum, video) => sum + video.views, 0);
  }

  private getVideosFromDays(videos: InstagramVideoWithStats[], days: number) {
    const date = this.getDateDaysAgo(days);

    return videos.filter((video) => {
      if (!video.timestamp) return false;

      return new Date(video.timestamp) >= date;
    });
  }

  private getTopVideos(videos: InstagramVideoWithStats[], limit = 5) {
    return [...videos].sort((a, b) => b.views - a.views).slice(0, limit);
  }

  private calculateCuratorSalary(totalViews: number) {
    if (totalViews >= this.curatorSalaryViewsLimit) {
      return this.fullCuratorSalary;
    }

    return this.round(totalViews * this.curatorSalaryViewRate);
  }

  async getInstagramUserStatistics(id: string) {
    const user = await this.prisma.instagramUserOld.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('Instagram аккаунт не найден');
    }

    const videos = await this.getVideosWithStats(
      user.instagram_account_id,
      user.access_token,
    );

    const weeklyVideos = this.getVideosFromDays(videos, 7);
    const monthlyVideos = this.getVideosFromDays(videos, 30);

    const totalViews = this.getTotalViews(videos);
    const weeklyViews = this.getTotalViews(weeklyVideos);
    const monthlyViews = this.getTotalViews(monthlyVideos);

    return {
      user,

      totalViews,
      weeklyViews,
      monthlyViews,

      curatorSalary: this.calculateCuratorSalary(monthlyViews),

      videos,

      topWeeklyVideos: this.getTopVideos(weeklyVideos),
      topMonthlyVideos: this.getTopVideos(monthlyVideos),
    };
  }

  async getAdminInstagramUsersStatistics() {
    const users = await this.prisma.instagramUserOld.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });

    const statistics = await Promise.all(
      users.map((user) => this.getInstagramUserStatistics(user.id)),
    );

    return statistics;
  }
}
