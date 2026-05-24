import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

type RequestWithUser = Request & {
  user?: {
    id: string;
  };
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    const moderator = await this.prisma.moderator.findUnique({
      where: {
        id: userId,
      },
      select: {
        isAdmin: true,
      },
    });

    if (!moderator || !moderator.isAdmin) {
      throw new ForbiddenException('Нет прав администратора');
    }

    return true;
  }
}
