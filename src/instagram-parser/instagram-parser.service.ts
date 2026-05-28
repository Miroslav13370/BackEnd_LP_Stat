import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

type JsonObject = {
  [key: string]: JsonValue;
};

type JsonArray = JsonValue[];

export type InstagramParserVideo = {
  id: string;
  url: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  publishedAt: string;
  timestamp: number;
};

export type InstagramProfileData = {
  username: string;
  accountUrl: string;
  avatarUrl: string | null;
  displayName: string | null;
  videos: InstagramParserVideo[];
};

export type InstagramProfileFetchOptions = {
  forceRefresh?: boolean;
};

type ParserCacheItem = {
  expiresAt: number;
  profile: InstagramProfileData;
};

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

const MAX_ATTEMPTS = 3;

@Injectable()
export class InstagramParserService {
  private readonly logger = new Logger(InstagramParserService.name);

  private readonly cache = new Map<string, ParserCacheItem>();

  private readonly inFlight = new Map<string, Promise<InstagramProfileData>>();

  private readonly headers = {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'sec-ch-ua': '"Not A(Brand";v="99", "Chromium";v="124"',
    'sec-ch-ua-mobile': '?0',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  } as const;

  normalizeUsername(rawUsername: string) {
    const normalized = rawUsername.trim().replace(/^@/, '');

    if (!normalized) {
      return '';
    }

    const splitByQuery = normalized.split(/[?#]/)[0];

    const withProtocol = splitByQuery.startsWith('http')
      ? splitByQuery
      : `https://${splitByQuery}`;

    try {
      const parsedUrl = new URL(withProtocol);

      if (parsedUrl.hostname.includes('instagram.com')) {
        const username = parsedUrl.pathname
          .split('/')
          .filter(Boolean)[0];

        if (username) {
          return username.toLowerCase();
        }
      }
    } catch {
      // not a URL, keep raw input
    }

    return splitByQuery.toLowerCase();
  }

  async fetchInstagramProfileByUsername(
    rawUsername: string,
    options: InstagramProfileFetchOptions = {},
  ): Promise<InstagramProfileData> {
    const username = this.normalizeUsername(rawUsername);

    if (!username) {
      throw new BadRequestException('Укажите корректный никнейм Instagram');
    }

    const cached = this.cache.get(username);
    const now = Date.now();

    if (!options.forceRefresh && cached && cached.expiresAt > now) {
      return cached.profile;
    }

    const inflight = this.inFlight.get(username);

    if (inflight) {
      return inflight;
    }

    const request = this.fetchInstagramProfileByUsernameInternal(username)
      .then((profile) => {
        this.cache.set(username, {
          profile,
          expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
        });

        return profile;
      })
      .finally(() => {
        this.inFlight.delete(username);
      });

    this.inFlight.set(username, request);

    return request;
  }

  private async fetchInstagramProfileByUsernameInternal(
    username: string,
  ): Promise<InstagramProfileData> {
    const endpoints = [
      {
        url: `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
          username,
        )}`,
        isJson: true,
      },
      {
        url: `https://www.instagram.com/${encodeURIComponent(
          username,
        )}/?__a=1&__d=dis`,
        isJson: true,
      },
      {
        url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
        isJson: false,
      },
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await this.requestWithRetry(endpoint.url, endpoint.isJson);

        const profile = this.parseInstagramPayload(response, username);

        if (profile) {
          return profile;
        }

        throw new Error('Instagram не вернул ожидаемые данные');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Неизвестная ошибка';

        lastError = new Error(errorMessage);

        this.logger.warn(
          `Не удалось получить профиль ${username} через ${endpoint.url}: ${errorMessage}`,
        );
      }
    }

    throw (
      lastError ??
      new Error('Не удалось получить публичный профиль Instagram.')
    );
  }

  private async requestWithRetry(url: string, parseAsJson: boolean, attempt = 1) {
    try {
      const response = await this.fetchWithTimeout(url);

      const text = await response.text();

      if (!response.ok) {
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_ATTEMPTS
        ) {
          const delayMs = Math.min(3_000, 500 * attempt);

          await this.sleep(delayMs);

          return this.requestWithRetry(url, parseAsJson, attempt + 1);
        }

        if (response.status === 404) {
          throw new Error('Профиль Instagram не найден');
        }

        throw new Error(`Instagram API вернул ${response.status}`);
      }

      if (!parseAsJson) {
        return { payload: text, text };
      }

      try {
        return { payload: JSON.parse(text), text };
      } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = Math.min(3_000, 500 * attempt);

          await this.sleep(delayMs);

          return this.requestWithRetry(url, parseAsJson, attempt + 1);
        }

        const parseError =
          error instanceof Error ? error.message : 'Ошибка разбора JSON';

        throw new Error(`Ошибка разбора JSON: ${parseError}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = Math.min(3_000, 500 * attempt);

          await this.sleep(delayMs);

          return this.requestWithRetry(url, parseAsJson, attempt + 1);
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        const delayMs = Math.min(3_000, 500 * attempt);

        await this.sleep(delayMs);

        return this.requestWithRetry(url, parseAsJson, attempt + 1);
      }

      throw error instanceof Error ? error : new Error('Ошибка сети');
    }
  }

  private async fetchWithTimeout(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        headers: {
          ...this.headers,
          'x-ig-app-id': '936619743392459',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseInstagramPayload(
    payload: { payload: unknown; text: string },
    username: string,
  ): InstagramProfileData | null {
    if (typeof payload.payload === 'string') {
      return this.parseInstagramHtml(payload.text, username);
    }

    const userNode = this.findInstagramUser(payload.payload);

    if (!userNode) {
      return this.parseInstagramHtml(payload.text, username);
    }

    const parsedVideos = this.extractVideosFromJson(userNode);

    return {
      username: this.getStringValue(userNode, 'username') ?? username,
      accountUrl: `https://www.instagram.com/${
        this.getStringValue(userNode, 'username') ?? username
      }`,
      avatarUrl:
        this.getStringValue(userNode, 'profile_pic_url_hd') ??
        this.getStringValue(userNode, 'profile_pic_url') ??
        null,
      displayName:
        this.getStringValue(userNode, 'full_name') ??
        this.getStringValue(userNode, 'username') ??
        null,
      videos: parsedVideos,
    };
  }

  private parseInstagramHtml(
    rawHtml: string,
    username: string,
  ): InstagramProfileData | null {
    const sharedData = this.extractJsonObject(rawHtml, 'window._sharedData =');

    const profileFromSharedData = sharedData
      ? this.findInstagramUser(sharedData)
      : null;

    if (profileFromSharedData) {
      return {
        username: this.getStringValue(profileFromSharedData, 'username') ?? username,
        accountUrl: `https://www.instagram.com/${
          this.getStringValue(profileFromSharedData, 'username') ?? username
        }`,
        avatarUrl:
          this.getStringValue(profileFromSharedData, 'profile_pic_url_hd') ??
          this.getStringValue(profileFromSharedData, 'profile_pic_url') ??
          null,
        displayName:
          this.getStringValue(profileFromSharedData, 'full_name') ??
          this.getStringValue(profileFromSharedData, 'username') ??
          null,
        videos: this.extractVideosFromJson(profileFromSharedData),
      };
    }

    const additionalData = this.extractJsonObject(
      rawHtml,
      'window.__additionalDataLoaded(',
    );

    const profileFromAdditional = additionalData
      ? this.findInstagramUser(additionalData)
      : null;

    if (!profileFromAdditional) {
      return null;
    }

    return {
      username: this.getStringValue(profileFromAdditional, 'username') ?? username,
      accountUrl: `https://www.instagram.com/${
        this.getStringValue(profileFromAdditional, 'username') ?? username
      }`,
      avatarUrl:
        this.getStringValue(profileFromAdditional, 'profile_pic_url_hd') ??
        this.getStringValue(profileFromAdditional, 'profile_pic_url') ??
        null,
      displayName:
        this.getStringValue(profileFromAdditional, 'full_name') ??
        this.getStringValue(profileFromAdditional, 'username') ??
        null,
      videos: this.extractVideosFromJson(profileFromAdditional),
    };
  }

  private findInstagramUser(payload: unknown): Record<string, unknown> | null {
    const queue: unknown[] = [payload];

    while (queue.length) {
      const current = queue.shift();

      if (!current || typeof current !== 'object') {
        continue;
      }

      if (Array.isArray(current)) {
        for (const item of current) {
          queue.push(item);
        }

        continue;
      }

      const node = current as Record<string, unknown>;

      const directUser = node.user;

      if (this.isInstagramUserNode(directUser)) {
        return directUser as Record<string, unknown>;
      }

      if (this.isInstagramUserNode(node)) {
        return node;
      }

      for (const nestedValue of Object.values(node)) {
        if (nestedValue && typeof nestedValue === 'object') {
          queue.push(nestedValue);
        }
      }
    }

    return null;
  }

  private isInstagramUserNode(value: unknown) {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const node = value as Record<string, unknown>;

    return (
      typeof this.getStringValue(node, 'username') === 'string' &&
      (typeof this.getStringValue(node, 'profile_pic_url') === 'string' ||
        typeof this.getStringValue(node, 'full_name') === 'string')
    );
  }

  private extractVideosFromJson(user: Record<string, unknown>): InstagramParserVideo[] {
    const edges =
      this.getNestedValue(user, 'edge_owner_to_timeline_media.edges') ??
      this.getNestedValue(user, 'edge_felix_video_timeline.edges') ??
      this.getNestedValue(user, 'timeline_media.items') ??
      [];

    if (!Array.isArray(edges)) {
      return [];
    }

    const resolvedEdges = edges
      .map((edge) => {
        if (!edge || typeof edge !== 'object') {
          return null;
        }

        if ('node' in edge && edge.node) {
          return edge;
        }

        if ('pk' in edge || 'media_type' in edge || 'is_video' in edge) {
          return { node: edge };
        }

        return null;
      })
      .filter((item): item is { node?: unknown } => item !== null);

    const videos = resolvedEdges
      .map((edge) => {
        if (!edge.node || typeof edge.node !== 'object') {
          return null;
        }

        const node = edge.node as Record<string, unknown>;

        const isVideo = this.getBooleanValue(node, 'is_video');

        if (!isVideo) {
          return null;
        }

        const nodeId = this.getStringValue(node, 'id') || this.getStringValue(node, 'pk');

        if (!nodeId) {
          return null;
        }

        const shortcode = this.getStringValue(node, 'shortcode');

        const timestamp = this.getNumberValue(node, 'taken_at_timestamp');

        const publishedAtDate = new Date(timestamp * 1000);

        if (Number.isNaN(publishedAtDate.getTime())) {
          return null;
        }

        const directUrl = this.getStringValue(node, 'video_url');

        const url = directUrl ?? `https://www.instagram.com/reel/${shortcode}/`;

        const caption = this.getStringValue(
          node,
          'edge_media_to_caption.edges[0].node.text',
        ) || this.getStringValue(node, 'accessibility_caption') || '';

        return {
          id: nodeId,
          url,
          caption,
          views: this.getNumberValue(node, 'video_view_count'),
          likes: this.getNumberValue(node, 'edge_liked_by.count'),
          comments: this.getNumberValue(node, 'edge_media_to_comment.count'),
          shares: this.getNumberValue(node, 'edge_media_to_parent_comment.count'),
          publishedAt: publishedAtDate.toISOString(),
          timestamp,
        };
      })
      .filter((video): video is InstagramParserVideo => video !== null)
      .sort((a, b) => b.timestamp - a.timestamp);

    return videos.slice(0, 100);
  }

  private getNestedValue(target: unknown, path: string): unknown {
    if (!path) {
      return target;
    }

    const keys = path.split('.').flatMap((part) => {
      const match = part.match(/^(.*)\[(\d+)\]$/);

      if (!match) {
        return [part];
      }

      return [match[1], match[2]];
    });

    let current: unknown = target;

    for (const key of keys) {
      if (typeof current !== 'object' || current === null) {
        return null;
      }

      if (Array.isArray(current)) {
        const index = Number(key);

        if (Number.isNaN(index)) {
          return null;
        }

        current = current[index];

        continue;
      }

      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private getStringValue(data: Record<string, unknown>, path: string) {
    const value = this.getNestedValue(data, path);

    return typeof value === 'string' ? value : null;
  }

  private getNumberValue(data: Record<string, unknown>, path: string) {
    const value = this.getNestedValue(data, path);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.replace(/[^\d]/g, '');
      const parsed = Number(normalized);

      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value && typeof value === 'object' && 'count' in value) {
      return this.getNumberValue(value as Record<string, unknown>, 'count');
    }

    return 0;
  }

  private getBooleanValue(data: Record<string, unknown>, path: string) {
    const value = this.getNestedValue(data, path);

    return Boolean(value);
  }

  private extractJsonObject(raw: string, marker: string) {
    const markerIndex = raw.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    const startIndex = raw.indexOf('{', markerIndex);

    if (startIndex < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < raw.length; i += 1) {
      const char = raw[i];

      if (inString) {
        if (escape) {
          escape = false;

          continue;
        }

        if (char === '\\') {
          escape = true;

          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
        continue;
      }

      if (char === '}') {
        depth -= 1;

        if (depth === 0) {
          const json = raw.slice(startIndex, i + 1);

          try {
            return JSON.parse(json) as JsonObject;
          } catch {
            return null;
          }
        }
      }
    }

    return null;
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
