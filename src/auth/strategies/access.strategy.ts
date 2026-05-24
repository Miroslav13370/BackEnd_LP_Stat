import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

type Cookies = {
  accessToken?: unknown;
};

type RequestWithCookies = Request & {
  cookies?: Cookies;
};

const getAccessTokenFromCookie = (req: Request): string | null => {
  const cookies = (req as unknown as RequestWithCookies).cookies;
  const token: unknown = cookies?.accessToken;
  return typeof token === 'string' ? token : null;
};

type JwtPayload = {
  id: string;
};

@Injectable()
export class AccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([getAccessTokenFromCookie]),
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  validate({ id }: JwtPayload) {
    return { id };
  }
}
