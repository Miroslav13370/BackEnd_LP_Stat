import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddInstagramAccountByModeratorDto,
  ConnectInstagramEditorDto,
  CreateInstagramAccountDto,
  UpdateInstagramAuthorContentDto,
  UpdateInstagramModeratorDto,
} from './dto/instagram-account.dto';
import { InstagramParserService } from 'src/instagram-parser/instagram-parser.service';

@Injectable()
export class InstagramAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramParser: InstagramParserService,
  ) {}

  private readonly accountInclude = {
    metricsReports: {
      orderBy: [
        { weekStartDate: 'desc' as const },
        { startDate: 'desc' as const },
        { createdAt: 'desc' as const },
      ],
    },
    viralVideosReports: {
      orderBy: [
        { weekStartDate: 'desc' as const },
        { startDate: 'desc' as const },
        { createdAt: 'desc' as const },
      ],
    },
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
  };

  private normalizeUsername(rawUsername: string) {
    return this.instagramParser.normalizeUsername(rawUsername);
  }

  private async ensureModeratorCanReceiveNewAccount(moderatorId: string) {
    const currentAccounts = await this.prisma.instagramAccount.findMany({
      where: {
        moderatorId,
      },
      select: {
        id: true,
      },
    });

    if (currentAccounts.length > 0) {
      throw new BadRequestException(
        'У этого модератора уже есть Instagram аккаунт. Сначала отвяжите текущий.',
      );
    }
  }

  async create(editorId: string, dto: CreateInstagramAccountDto) {
    const existsAccount = await this.prisma.instagramAccount.findUnique({
      where: { username: dto.username },
    });

    if (existsAccount) {
      throw new ConflictException(
        'Instagram аккаунт с таким username уже есть',
      );
    }

    return this.prisma.instagramAccount.create({
      data: {
        username: dto.username,
        accountUrl: dto.accountUrl,
        avatarUrl: dto.avatarUrl,
        editorId,
      },
    });
  }

  async createForModerator(moderatorId: string, dto: AddInstagramAccountByModeratorDto) {
    const username = this.normalizeUsername(dto.username);

    if (!username) {
      throw new BadRequestException('Укажите корректный ник Instagram');
    }

    await this.ensureModeratorCanReceiveNewAccount(moderatorId);

    const existsAccount = await this.prisma.instagramAccount.findUnique({
      where: { username },
    });

    if (existsAccount) {
      if (
        existsAccount.moderatorId &&
        existsAccount.moderatorId !== moderatorId
      ) {
        throw new BadRequestException(
          'Этот Instagram аккаунт уже прикреплён к другому модератору',
        );
      }

      return this.prisma.instagramAccount.update({
        where: { id: existsAccount.id },
        data: {
          moderatorId,
          avatarUrl:
            existsAccount.avatarUrl ??
            (await this.fetchInstagramProfileMeta(username)).avatarUrl,
          accountUrl:
            existsAccount.accountUrl ||
            `https://www.instagram.com/${username.replace(/^@/, '')}`,
          editorId: existsAccount.editorId,
        },
        include: this.accountInclude,
      });
    }

    const profile = await this.fetchInstagramProfileMeta(username);

    return this.prisma.instagramAccount.create({
      data: {
        username: profile.username,
        accountUrl: profile.accountUrl,
        avatarUrl: profile.avatarUrl,
        moderatorId,
      },
      include: this.accountInclude,
    });
  }

  async updateEditorAccountsModerator(
    editorId: string,
    dto: UpdateInstagramModeratorDto,
  ) {
    const editor = await this.prisma.instagramEditor.findUnique({
      where: { id: editorId },
      include: {
        instagramAccounts: {
          select: { id: true },
        },
      },
    });

    if (!editor) {
      throw new NotFoundException('Монтажёр не найден');
    }

    if (!editor.instagramAccounts.length) {
      throw new NotFoundException('У этого монтажёра нет Instagram аккаунтов');
    }

    if (dto.moderatorId) {
      const moderator = await this.prisma.moderator.findUnique({
        where: { id: dto.moderatorId },
      });

      if (!moderator) {
        throw new NotFoundException('Модератор не найден');
      }

      if (editor.instagramAccounts.length > 1) {
        throw new BadRequestException(
          'Нужно добавить только один Instagram аккаунт для такого модератора',
        );
      }

      const occupied = await this.prisma.instagramAccount.findFirst({
        where: {
          moderatorId: dto.moderatorId,
          editorId: { not: editorId },
        },
        select: {
          id: true,
        },
      });

      if (occupied) {
        throw new BadRequestException(
          'Этот модератор уже привязан к другому Instagram аккаунту',
        );
      }
    }

    await this.prisma.instagramAccount.updateMany({
      where: { editorId },
      data: {
        moderatorId: dto.moderatorId ?? null,
      },
    });

    return {
      message: 'Модератор обновлён у всех Instagram аккаунтов монтажёра',
      editorId,
      updatedCount: editor.instagramAccounts.length,
      moderatorId: dto.moderatorId ?? null,
    };
  }

  async updateAccountModerator(
    accountId: string,
    dto: UpdateInstagramModeratorDto,
  ) {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Instagram аккаунт не найден');
    }

    if (dto.moderatorId) {
      const moderator = await this.prisma.moderator.findUnique({
        where: { id: dto.moderatorId },
      });

      if (!moderator) {
        throw new NotFoundException('Модератор не найден');
      }

      const occupiedByModerator = await this.prisma.instagramAccount.findFirst({
        where: {
          moderatorId: dto.moderatorId,
          id: {
            not: accountId,
          },
        },
        select: {
          id: true,
          username: true,
        },
      });

      if (occupiedByModerator) {
        throw new BadRequestException(
          `У выбранного модератора уже есть Instagram аккаунт @${occupiedByModerator.username}. Сначала отвяжите его.`,
        );
      }
    }

    return this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        moderatorId: dto.moderatorId ?? null,
      },
      include: this.accountInclude,
    });
  }

  async getMyAccounts(editorId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { editorId },
      include: this.accountInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyAccountById(editorId: string, accountId: string) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: {
        id: accountId,
        editorId,
      },
      include: this.accountInclude,
    });

    if (!account) {
      throw new NotFoundException('Instagram аккаунт не найден');
    }

    return account;
  }

  async getById(id: string) {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id },
      include: this.accountInclude,
    });

    if (!account) {
      throw new NotFoundException('Instagram аккаунт не найден');
    }

    return account;
  }

  async connectEditorAccountsToModerator(
    moderatorId: string,
    dto: ConnectInstagramEditorDto,
  ) {
    const editor = await this.prisma.instagramEditor.findUnique({
      where: { id: dto.editorKey },
      include: {
        instagramAccounts: {
          select: {
            id: true,
            username: true,
            moderatorId: true,
          },
        },
      },
    });

    if (!editor) {
      throw new NotFoundException('Монтажёр по такому ключу не найден');
    }

    if (!editor.instagramAccounts.length) {
      throw new NotFoundException('У этого монтажёра нет Instagram аккаунтов');
    }

    const accountIds = editor.instagramAccounts.map((account) => account.id);

    await this.prisma.instagramAccount.updateMany({
      where: { editorId: editor.id },
      data: { moderatorId },
    });

    return {
      message: 'Instagram аккаунты монтажёра успешно привязаны',
      editorId: editor.id,
      editorLogin: editor.login,
      connectedCount: accountIds.length,
      accountIds,
    };
  }

  async disconnectEditorAccountsFromModerator(editorId: string) {
    const editor = await this.prisma.instagramEditor.findUnique({
      where: { id: editorId },
      include: {
        instagramAccounts: {
          select: { id: true },
        },
      },
    });

    if (!editor) {
      throw new NotFoundException('Монтажёр не найден');
    }

    if (!editor.instagramAccounts.length) {
      throw new NotFoundException('У этого монтажёра нет Instagram аккаунтов');
    }

    const accountIds = editor.instagramAccounts.map((account) => account.id);

    await this.prisma.instagramAccount.updateMany({
      where: { editorId },
      data: { moderatorId: null },
    });

    return {
      message: 'Instagram аккаунты монтажёра отвязаны от модератора',
      editorId,
      disconnectedCount: accountIds.length,
      accountIds,
    };
  }

  async disconnectAccountFromModerator(accountId: string) {
    return this.updateAccountModerator(accountId, {
      moderatorId: null,
    });
  }

  async updateAuthorContent(
    accountId: string,
    dto: UpdateInstagramAuthorContentDto,
  ) {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Instagram аккаунт не найден');
    }

    return this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        isAuthorContent: dto.isAuthorContent,
      },
      include: this.accountInclude,
    });
  }

  async updateEditorAccountsAuthorContent(
    editorId: string,
    dto: UpdateInstagramAuthorContentDto,
  ) {
    const editor = await this.prisma.instagramEditor.findUnique({
      where: { id: editorId },
      include: {
        instagramAccounts: {
          select: { id: true },
        },
      },
    });

    if (!editor) {
      throw new NotFoundException('Монтажёр не найден');
    }

    if (!editor.instagramAccounts.length) {
      throw new NotFoundException('У этого монтажёра нет Instagram аккаунтов');
    }

    await this.prisma.instagramAccount.updateMany({
      where: { editorId },
      data: {
        isAuthorContent: dto.isAuthorContent,
      },
    });

    return {
      message: 'Тип контента обновлён у всех Instagram аккаунтов монтажёра',
      editorId,
      updatedCount: editor.instagramAccounts.length,
      isAuthorContent: dto.isAuthorContent,
    };
  }

  async deleteAccount(accountId: string) {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Instagram аккаунт не найден');
    }

    await this.prisma.instagramAccount.delete({
      where: { id: accountId },
    });

    return {
      message: 'Instagram аккаунт удалён',
      deletedId: accountId,
    };
  }

  private async fetchInstagramProfileMeta(username: string) {
    const normalized = this.normalizeUsername(username);

    const profile =
      await this.instagramParser.fetchInstagramProfileByUsername(normalized);

    return {
      username: profile.username,
      accountUrl: `https://www.instagram.com/${normalized.replace(/^@/, '')}`,
      avatarUrl: profile.avatarUrl ?? null,
      displayName: profile.displayName,
    };
  }
}
