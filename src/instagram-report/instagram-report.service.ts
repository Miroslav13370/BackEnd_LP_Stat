import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InstagramReportPeriodType,
  InstagramReportStatus,
  Prisma,
} from 'prisma/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateInstagramMetricsReportDto,
  CreateInstagramViralVideosReportDto,
  RejectInstagramReportDto,
  UpdateInstagramMetricsReportDto,
  UpdateInstagramViralVideosReportDto,
} from './dto/instagram-report.dto';

@Injectable()
export class InstagramReportService {
  constructor(private readonly prisma: PrismaService) {}

  private toJsonValue<T>(value: T): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private parseDate(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private getReportPeriod(dto: {
    periodType: InstagramReportPeriodType;
    weekStartDate?: string;
    weekEndDate?: string;
    startDate?: string;
    endDate?: string;
  }) {
    if (dto.periodType === InstagramReportPeriodType.WEEK) {
      if (!dto.weekStartDate || !dto.weekEndDate) {
        throw new BadRequestException({
          message: 'Не выбран период отчёта',
          reason: 'Для недельного отчёта нужно указать начало и конец недели',
        });
      }

      const weekStartDate = this.parseDate(dto.weekStartDate);
      const weekEndDate = this.parseDate(dto.weekEndDate);

      if (weekStartDate >= weekEndDate) {
        throw new BadRequestException({
          message: 'Неверный период',
          reason: 'Дата начала недели должна быть раньше даты окончания',
        });
      }

      return {
        weekStartDate,
        weekEndDate,
        startDate: null,
        endDate: null,
      };
    }

    if (
      dto.periodType === InstagramReportPeriodType.CUSTOM ||
      dto.periodType === InstagramReportPeriodType.MONTH
    ) {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException({
          message: 'Не выбран период отчёта',
          reason: 'Для этого типа отчёта нужно указать дату начала и окончания',
        });
      }

      const startDate = this.parseDate(dto.startDate);
      const endDate = this.parseDate(dto.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException({
          message: 'Неверный период',
          reason: 'Дата начала должна быть раньше даты окончания',
        });
      }

      return {
        weekStartDate: null,
        weekEndDate: null,
        startDate,
        endDate,
      };
    }

    return {
      weekStartDate: null,
      weekEndDate: null,
      startDate: null,
      endDate: null,
    };
  }

  private getPeriodSortDate(report: {
    weekStartDate: Date | null;
    startDate: Date | null;
    createdAt: Date;
  }) {
    return report.weekStartDate ?? report.startDate ?? report.createdAt;
  }

  private getDeltas(
    current: {
      currentTotalViews: number;
      currentTotalLikes: number;
      currentVideosCount: number;
    },
    previous?: {
      currentTotalViews: number;
      currentTotalLikes: number;
      currentVideosCount: number;
    } | null,
  ) {
    return {
      viewsDelta:
        current.currentTotalViews - (previous?.currentTotalViews ?? 0),
      likesDelta:
        current.currentTotalLikes - (previous?.currentTotalLikes ?? 0),
      videosDelta:
        current.currentVideosCount - (previous?.currentVideosCount ?? 0),
    };
  }

  private async ensureAccountBelongsToEditor(
    editorId: string,
    instagramAccountId: string,
  ) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        editorId,
      },
    });

    if (!account) {
      throw new ForbiddenException({
        message: 'Instagram аккаунт не найден',
        reason: 'Аккаунт не существует или не принадлежит вам',
      });
    }

    return account;
  }

  private async ensureModeratorCanManageReport(
    moderatorId: string,
    report: {
      instagramAccount: {
        id: string;
        moderatorId: string | null;
      };
    },
    isAdmin: boolean,
  ) {
    if (isAdmin) return;

    if (
      report.instagramAccount.moderatorId &&
      report.instagramAccount.moderatorId !== moderatorId
    ) {
      throw new ForbiddenException({
        message: 'Нет доступа к отчёту',
        reason: 'Этот Instagram аккаунт привязан к другому модератору',
      });
    }

    if (!report.instagramAccount.moderatorId) {
      await this.prisma.instagramAccount.update({
        where: {
          id: report.instagramAccount.id,
        },
        data: {
          moderatorId,
        },
      });
    }
  }

  private async getPreviousVerifiedMetricsReport(
    instagramAccountId: string,
    currentReportId: string,
    currentDate: Date,
  ) {
    return this.prisma.instagramMetricsReport.findFirst({
      where: {
        id: {
          not: currentReportId,
        },
        instagramAccountId,
        status: InstagramReportStatus.VERIFIED,
        OR: [
          {
            weekStartDate: {
              lt: currentDate,
            },
          },
          {
            startDate: {
              lt: currentDate,
            },
          },
        ],
      },
      orderBy: [
        {
          weekStartDate: 'desc',
        },
        {
          startDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async createMetricsReport(
    editorId: string,
    dto: CreateInstagramMetricsReportDto,
  ) {
    const account = await this.ensureAccountBelongsToEditor(
      editorId,
      dto.instagramAccountId,
    );

    const period = this.getReportPeriod({
      periodType: dto.periodType,
      weekStartDate: dto.weekStartDate,
      weekEndDate: dto.weekEndDate,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    const existingReport = await this.prisma.instagramMetricsReport.findFirst({
      where: {
        instagramAccountId: account.id,
        periodType: dto.periodType,
        weekStartDate: period.weekStartDate,
        weekEndDate: period.weekEndDate,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });

    if (existingReport) {
      throw new ConflictException({
        message: 'Отчёт по общей статистике за этот период уже существует',
        reason:
          'Вы можете отредактировать существующий отчёт, он снова попадёт модератору на проверку',
        reportId: existingReport.id,
      });
    }

    return this.prisma.instagramMetricsReport.create({
      data: {
        instagramAccountId: account.id,

        periodType: dto.periodType,

        weekStartDate: period.weekStartDate,
        weekEndDate: period.weekEndDate,
        startDate: period.startDate,
        endDate: period.endDate,

        currentTotalViews: dto.currentTotalViews,
        currentTotalLikes: dto.currentTotalLikes,
        currentVideosCount: dto.currentVideosCount,

        viewsDelta: 0,
        likesDelta: 0,
        videosDelta: 0,

        status: InstagramReportStatus.PENDING,
        rejectReason: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async createViralVideosReport(
    editorId: string,
    dto: CreateInstagramViralVideosReportDto,
  ) {
    const account = await this.ensureAccountBelongsToEditor(
      editorId,
      dto.instagramAccountId,
    );

    const period = this.getReportPeriod({
      periodType: dto.periodType,
      weekStartDate: dto.weekStartDate,
      weekEndDate: dto.weekEndDate,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    const existingReport =
      await this.prisma.instagramViralVideosReport.findFirst({
        where: {
          instagramAccountId: account.id,
          periodType: dto.periodType,
          weekStartDate: period.weekStartDate,
          weekEndDate: period.weekEndDate,
          startDate: period.startDate,
          endDate: period.endDate,
        },
      });

    if (existingReport) {
      throw new ConflictException({
        message: 'Отчёт по видео 1000+ за этот период уже существует',
        reason:
          'Вы можете отредактировать существующий отчёт, он снова попадёт модератору на проверку',
        reportId: existingReport.id,
      });
    }

    return this.prisma.instagramViralVideosReport.create({
      data: {
        instagramAccountId: account.id,

        periodType: dto.periodType,

        weekStartDate: period.weekStartDate,
        weekEndDate: period.weekEndDate,
        startDate: period.startDate,
        endDate: period.endDate,

        videosCount: dto.videos.length,
        videos: this.toJsonValue(dto.videos),

        status: InstagramReportStatus.PENDING,
        rejectReason: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async getMyMetricsReports(editorId: string, instagramAccountId?: string) {
    return this.prisma.instagramMetricsReport.findMany({
      where: {
        instagramAccount: {
          editorId,
        },
        ...(instagramAccountId ? { instagramAccountId } : {}),
      },
      include: {
        instagramAccount: {
          select: {
            id: true,
            username: true,
            accountUrl: true,
            avatarUrl: true,
            moderatorId: true,
          },
        },
      },
      orderBy: [
        {
          weekStartDate: 'desc',
        },
        {
          startDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async getMyViralVideosReports(editorId: string, instagramAccountId?: string) {
    return this.prisma.instagramViralVideosReport.findMany({
      where: {
        instagramAccount: {
          editorId,
        },
        ...(instagramAccountId ? { instagramAccountId } : {}),
      },
      include: {
        instagramAccount: {
          select: {
            id: true,
            username: true,
            accountUrl: true,
            avatarUrl: true,
            moderatorId: true,
          },
        },
      },
      orderBy: [
        {
          weekStartDate: 'desc',
        },
        {
          startDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async getPendingMetricsReports(moderatorId: string, isAdmin = false) {
    return this.prisma.instagramMetricsReport.findMany({
      where: {
        status: InstagramReportStatus.PENDING,
        instagramAccount: isAdmin
          ? {}
          : {
              OR: [
                {
                  moderatorId,
                },
                {
                  moderatorId: null,
                },
              ],
            },
      },
      include: {
        instagramAccount: {
          include: {
            editor: {
              select: {
                id: true,
                login: true,
              },
            },
            moderator: {
              select: {
                id: true,
                login: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPendingViralVideosReports(moderatorId: string, isAdmin = false) {
    return this.prisma.instagramViralVideosReport.findMany({
      where: {
        status: InstagramReportStatus.PENDING,
        instagramAccount: isAdmin
          ? {}
          : {
              OR: [
                {
                  moderatorId,
                },
                {
                  moderatorId: null,
                },
              ],
            },
      },
      include: {
        instagramAccount: {
          include: {
            editor: {
              select: {
                id: true,
                login: true,
              },
            },
            moderator: {
              select: {
                id: true,
                login: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateMetricsReport(
    editorId: string,
    reportId: string,
    dto: UpdateInstagramMetricsReportDto,
  ) {
    const report = await this.prisma.instagramMetricsReport.findFirst({
      where: {
        id: reportId,
        instagramAccount: {
          editorId,
        },
      },
      include: {
        instagramAccount: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по общей статистике не найден',
        reason: 'Отчёт не существует или не принадлежит вам',
      });
    }

    const nextPeriodType = dto.periodType ?? report.periodType;

    const period = this.getReportPeriod({
      periodType: nextPeriodType,
      weekStartDate: dto.weekStartDate ?? report.weekStartDate?.toISOString(),
      weekEndDate: dto.weekEndDate ?? report.weekEndDate?.toISOString(),
      startDate: dto.startDate ?? report.startDate?.toISOString(),
      endDate: dto.endDate ?? report.endDate?.toISOString(),
    });

    return this.prisma.instagramMetricsReport.update({
      where: {
        id: report.id,
      },
      data: {
        periodType: nextPeriodType,

        weekStartDate: period.weekStartDate,
        weekEndDate: period.weekEndDate,
        startDate: period.startDate,
        endDate: period.endDate,

        currentTotalViews: dto.currentTotalViews ?? report.currentTotalViews,
        currentTotalLikes: dto.currentTotalLikes ?? report.currentTotalLikes,
        currentVideosCount: dto.currentVideosCount ?? report.currentVideosCount,

        viewsDelta: 0,
        likesDelta: 0,
        videosDelta: 0,

        status: InstagramReportStatus.PENDING,
        rejectReason: null,
        verifiedAt: null,
        verifiedByModeratorId: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async updateViralVideosReport(
    editorId: string,
    reportId: string,
    dto: UpdateInstagramViralVideosReportDto,
  ) {
    const report = await this.prisma.instagramViralVideosReport.findFirst({
      where: {
        id: reportId,
        instagramAccount: {
          editorId,
        },
      },
      include: {
        instagramAccount: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по видео 1000+ не найден',
        reason: 'Отчёт не существует или не принадлежит вам',
      });
    }

    const nextPeriodType = dto.periodType ?? report.periodType;

    const period = this.getReportPeriod({
      periodType: nextPeriodType,
      weekStartDate: dto.weekStartDate ?? report.weekStartDate?.toISOString(),
      weekEndDate: dto.weekEndDate ?? report.weekEndDate?.toISOString(),
      startDate: dto.startDate ?? report.startDate?.toISOString(),
      endDate: dto.endDate ?? report.endDate?.toISOString(),
    });

    const nextVideos =
      dto.videos !== undefined
        ? this.toJsonValue(dto.videos)
        : (report.videos as Prisma.InputJsonValue);

    return this.prisma.instagramViralVideosReport.update({
      where: {
        id: report.id,
      },
      data: {
        periodType: nextPeriodType,

        weekStartDate: period.weekStartDate,
        weekEndDate: period.weekEndDate,
        startDate: period.startDate,
        endDate: period.endDate,

        videosCount:
          dto.videos !== undefined ? dto.videos.length : report.videosCount,
        videos: nextVideos,

        status: InstagramReportStatus.PENDING,
        rejectReason: null,
        verifiedAt: null,
        verifiedByModeratorId: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async verifyMetricsReport(
    moderatorId: string,
    reportId: string,
    isAdmin = false,
  ) {
    const report = await this.prisma.instagramMetricsReport.findUnique({
      where: {
        id: reportId,
      },
      include: {
        instagramAccount: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по общей статистике не найден',
        reason: 'Возможно, отчёт был удалён монтажёром',
      });
    }

    await this.ensureModeratorCanManageReport(moderatorId, report, isAdmin);

    if (report.status !== InstagramReportStatus.PENDING) {
      throw new ConflictException({
        message: 'Нельзя подтвердить отчёт',
        reason: 'Подтвердить можно только отчёт, который находится на проверке',
      });
    }

    const currentDate = this.getPeriodSortDate(report);

    const previousReport = await this.getPreviousVerifiedMetricsReport(
      report.instagramAccountId,
      report.id,
      currentDate,
    );

    const deltas = this.getDeltas(report, previousReport);

    return this.prisma.instagramMetricsReport.update({
      where: {
        id: report.id,
      },
      data: {
        ...deltas,
        status: InstagramReportStatus.VERIFIED,
        verifiedByModeratorId: moderatorId,
        verifiedAt: new Date(),
        rejectReason: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async verifyViralVideosReport(
    moderatorId: string,
    reportId: string,
    isAdmin = false,
  ) {
    const report = await this.prisma.instagramViralVideosReport.findUnique({
      where: {
        id: reportId,
      },
      include: {
        instagramAccount: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по видео 1000+ не найден',
        reason: 'Возможно, отчёт был удалён монтажёром',
      });
    }

    await this.ensureModeratorCanManageReport(moderatorId, report, isAdmin);

    if (report.status !== InstagramReportStatus.PENDING) {
      throw new ConflictException({
        message: 'Нельзя подтвердить отчёт',
        reason: 'Подтвердить можно только отчёт, который находится на проверке',
      });
    }

    return this.prisma.instagramViralVideosReport.update({
      where: {
        id: report.id,
      },
      data: {
        status: InstagramReportStatus.VERIFIED,
        verifiedByModeratorId: moderatorId,
        verifiedAt: new Date(),
        rejectReason: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async rejectMetricsReport(
    moderatorId: string,
    reportId: string,
    dto: RejectInstagramReportDto,
    isAdmin = false,
  ) {
    const report = await this.prisma.instagramMetricsReport.findUnique({
      where: {
        id: reportId,
      },
      include: {
        instagramAccount: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по общей статистике не найден',
        reason: 'Возможно, отчёт был удалён монтажёром',
      });
    }

    await this.ensureModeratorCanManageReport(moderatorId, report, isAdmin);

    if (report.status !== InstagramReportStatus.PENDING) {
      throw new ConflictException({
        message: 'Нельзя отклонить отчёт',
        reason: 'Отклонить можно только отчёт, который находится на проверке',
      });
    }

    return this.prisma.instagramMetricsReport.update({
      where: {
        id: report.id,
      },
      data: {
        status: InstagramReportStatus.REJECTED,
        rejectReason: dto.rejectReason ?? 'Отчёт отклонён модератором',
        verifiedAt: null,
        verifiedByModeratorId: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async rejectViralVideosReport(
    moderatorId: string,
    reportId: string,
    dto: RejectInstagramReportDto,
    isAdmin = false,
  ) {
    const report = await this.prisma.instagramViralVideosReport.findUnique({
      where: {
        id: reportId,
      },
      include: {
        instagramAccount: true,
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по видео 1000+ не найден',
        reason: 'Возможно, отчёт был удалён монтажёром',
      });
    }

    await this.ensureModeratorCanManageReport(moderatorId, report, isAdmin);

    if (report.status !== InstagramReportStatus.PENDING) {
      throw new ConflictException({
        message: 'Нельзя отклонить отчёт',
        reason: 'Отклонить можно только отчёт, который находится на проверке',
      });
    }

    return this.prisma.instagramViralVideosReport.update({
      where: {
        id: report.id,
      },
      data: {
        status: InstagramReportStatus.REJECTED,
        rejectReason: dto.rejectReason ?? 'Отчёт отклонён модератором',
        verifiedAt: null,
        verifiedByModeratorId: null,
      },
      include: {
        instagramAccount: true,
      },
    });
  }

  async deleteMetricsReport(editorId: string, reportId: string) {
    const report = await this.prisma.instagramMetricsReport.findFirst({
      where: {
        id: reportId,
        instagramAccount: {
          editorId,
        },
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по общей статистике не найден',
        reason: 'Отчёт не существует или не принадлежит вам',
      });
    }

    await this.prisma.instagramMetricsReport.delete({
      where: {
        id: report.id,
      },
    });

    return {
      message: 'Отчёт по общей статистике удалён',
      deletedId: report.id,
    };
  }

  async deleteViralVideosReport(editorId: string, reportId: string) {
    const report = await this.prisma.instagramViralVideosReport.findFirst({
      where: {
        id: reportId,
        instagramAccount: {
          editorId,
        },
      },
    });

    if (!report) {
      throw new NotFoundException({
        message: 'Отчёт по видео 1000+ не найден',
        reason: 'Отчёт не существует или не принадлежит вам',
      });
    }

    await this.prisma.instagramViralVideosReport.delete({
      where: {
        id: report.id,
      },
    });

    return {
      message: 'Отчёт по видео 1000+ удалён',
      deletedId: report.id,
    };
  }
}
