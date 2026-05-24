import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import type { Response } from 'express';
import type { StringValue } from 'ms';

import { PrismaService } from 'src/prisma/prisma.service';
import {
  InstagramEditorAuthDto,
  RegisterInstagramEditorWithAccountDto,
} from './dto/instagram-auth.dto';

export type InstagramEditorJwtPayload = {
  id: string;
  login: string;
};

@Injectable()
export class InstagramAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async signTokens(payload: InstagramEditorJwtPayload) {
    const accessExpiresIn = this.configService.getOrThrow<StringValue>(
      'INSTAGRAM_EDITOR_ACCESS_EXPIRES',
    );

    const refreshExpiresIn = this.configService.getOrThrow<StringValue>(
      'INSTAGRAM_EDITOR_REFRESH_EXPIRES',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>(
        'INSTAGRAM_EDITOR_ACCESS_SECRET',
      ),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>(
        'INSTAGRAM_EDITOR_REFRESH_SECRET',
      ),
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private setAuthCookies(
    res: Response,
    tokens: {
      accessToken: string;
      refreshToken: string;
    },
  ) {
    res.cookie('instagramAccessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    });

    res.cookie('instagramRefreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('instagramAccessToken');
    res.clearCookie('instagramRefreshToken');
  }

  private async saveRefreshTokenHash(editorId: string, refreshToken: string) {
    await this.prisma.instagramEditor.update({
      where: {
        id: editorId,
      },
      data: {
        refreshTokenHash: await hash(refreshToken),
      },
    });
  }

  private getEditorResponse(editor: { id: string; login: string }) {
    return {
      id: editor.id,
      login: editor.login,
      connectKey: editor.id,
    };
  }

  async register(dto: InstagramEditorAuthDto, res: Response) {
    const existsEditor = await this.prisma.instagramEditor.findUnique({
      where: {
        login: dto.login,
      },
    });

    if (existsEditor) {
      throw new ConflictException(
        'Пользователь с таким логином уже существует',
      );
    }

    const editor = await this.prisma.instagramEditor.create({
      data: {
        login: dto.login,
        passwordHash: await hash(dto.password),
      },
    });

    const tokens = await this.signTokens({
      id: editor.id,
      login: editor.login,
    });

    await this.saveRefreshTokenHash(editor.id, tokens.refreshToken);

    this.setAuthCookies(res, tokens);

    return this.getEditorResponse(editor);
  }

  async login(dto: InstagramEditorAuthDto, res: Response) {
    const editor = await this.prisma.instagramEditor.findUnique({
      where: {
        login: dto.login,
      },
    });

    if (!editor) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const isPasswordValid = await verify(editor.passwordHash, dto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const tokens = await this.signTokens({
      id: editor.id,
      login: editor.login,
    });

    await this.saveRefreshTokenHash(editor.id, tokens.refreshToken);

    this.setAuthCookies(res, tokens);

    return this.getEditorResponse(editor);
  }

  async me(editorId: string) {
    const editor = await this.prisma.instagramEditor.findUnique({
      where: {
        id: editorId,
      },
      select: {
        id: true,
        login: true,
        createdAt: true,
        updatedAt: true,
        instagramAccounts: {
          select: {
            id: true,
            username: true,
            accountUrl: true,
            avatarUrl: true,
            moderatorId: true,
            isAuthorContent: true,
            planTarget: true,
            createdAt: true,
            updatedAt: true,
            moderator: {
              select: {
                id: true,
                login: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!editor) {
      throw new NotFoundException('Монтажёр не найден');
    }

    return {
      ...editor,
      connectKey: editor.id,
    };
  }

  async logout(editorId: string, res: Response) {
    await this.prisma.instagramEditor.update({
      where: {
        id: editorId,
      },
      data: {
        refreshTokenHash: null,
      },
    });

    this.clearAuthCookies(res);

    return {
      message: 'Вы вышли из аккаунта',
    };
  }

  async registerWithAccount(
    dto: RegisterInstagramEditorWithAccountDto,
    res: Response,
  ) {
    const existsEditor = await this.prisma.instagramEditor.findUnique({
      where: {
        login: dto.login,
      },
    });

    if (existsEditor) {
      throw new ConflictException(
        'Пользователь с таким логином уже существует',
      );
    }

    const existsAccount = await this.prisma.instagramAccount.findUnique({
      where: {
        username: dto.username,
      },
    });

    if (existsAccount) {
      throw new ConflictException(
        'Instagram аккаунт с таким username уже есть',
      );
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const editor = await prisma.instagramEditor.create({
        data: {
          login: dto.login,
          passwordHash: await hash(dto.password),
        },
      });

      const account = await prisma.instagramAccount.create({
        data: {
          username: dto.username,
          accountUrl: dto.accountUrl,
          avatarUrl: dto.avatarUrl,
          editorId: editor.id,
        },
      });

      return {
        editor,
        account,
      };
    });

    const tokens = await this.signTokens({
      id: result.editor.id,
      login: result.editor.login,
    });

    await this.saveRefreshTokenHash(result.editor.id, tokens.refreshToken);

    this.setAuthCookies(res, tokens);

    return {
      editor: this.getEditorResponse(result.editor),
      account: result.account,
    };
  }
}
