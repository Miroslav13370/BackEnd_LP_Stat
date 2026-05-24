import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { InstagramEditorJwtPayload } from '../instagram-auth.service';

type RequestWithCookies = Request & {
  cookies?: {
    instagramAccessToken?: string;
  };
};

const cookieExtractor = (req: RequestWithCookies): string | null => {
  return req.cookies?.instagramAccessToken ?? null;
};

@Injectable()
export class InstagramEditorAccessStrategy extends PassportStrategy(
  Strategy,
  'instagram-editor-access',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      secretOrKey: configService.getOrThrow<string>(
        'INSTAGRAM_EDITOR_ACCESS_SECRET',
      ),
      ignoreExpiration: false,
      passReqToCallback: false,
    });
  }

  validate(payload: InstagramEditorJwtPayload): InstagramEditorJwtPayload {
    return payload;
  }
}
