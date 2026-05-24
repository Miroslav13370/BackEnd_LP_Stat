import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConnectInstagramEditorDto,
  CreateInstagramAccountDto,
  UpdateInstagramAuthorContentDto,
  UpdateInstagramModeratorDto,
} from './dto/instagram-account.dto';

@Injectable()
export class InstagramAccountService {
  constructor(private readonly prisma: PrismaService) {}

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
    }

    return this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        moderatorId: dto.moderatorId ?? null,
      },
      include: this.accountInclude,
    });
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
}
