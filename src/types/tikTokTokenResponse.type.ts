export type TikTokTokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: 'Bearer';
};

export type TikTokVideosResponse = {
  data: {
    videos: TikTokVideo[];
    cursor: number;
    has_more: boolean;
  };
};

export type TikTokVideo = {
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

export type TikTokUserProfile = {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  username?: string;
};

export type TikTokUserInfoResponse = {
  data: {
    user: TikTokUserProfile;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
};

export type TikTokAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
};
