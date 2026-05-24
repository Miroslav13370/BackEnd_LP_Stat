import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

type Cookies = {
  refreshToken?: unknown;
};

type RequestWithCookies = Request & {
  cookies?: Cookies;
};

const getRefreshTokenFromCookie = (req: Request): string | null => {
  const cookies = (req as unknown as RequestWithCookies).cookies;

  const token: unknown = cookies?.refreshToken;

  return typeof token === 'string' ? token : null;
};

export type JwtPayload = {
  id: string;
};

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([getRefreshTokenFromCookie]),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, { id }: JwtPayload) {
    const refreshToken = getRefreshTokenFromCookie(req);

    return {
      id,
      refreshToken,
    };
  }
}
