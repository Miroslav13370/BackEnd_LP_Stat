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

  refresh_token: string | null;

  youtube_channel_id: string;

  youtube_title: string | null;
};

export type YouTubeSearchListResponse = {
  nextPageToken?: string;

  items?: Array<{
    id?: {
      videoId?: string;
    };

    snippet?: {
      publishedAt?: string;
    };
  }>;

  error?: {
    code: number;

    message: string;
  };
};

export type YouTubeVideosListResponse = {
  items?: Array<{
    id: string;

    snippet?: {
      publishedAt?: string;

      title?: string;

      description?: string;

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

        standard?: {
          url?: string;
        };

        maxres?: {
          url?: string;
        };
      };
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
