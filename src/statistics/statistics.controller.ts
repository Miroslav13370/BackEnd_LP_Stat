import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { AdminGuard } from 'src/auth/strategies/admin.strategy';
import { JwtPayload } from 'src/auth/strategies/refresh.strategy';
import { StatisticsPeriodDto } from './dto/statistics-period.dto';
import { StatisticsService } from './statistics.service';

type RequestWithUser = Request & {
  user: JwtPayload;
};

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('moderator/me')
  @UseGuards(AuthGuard('jwt-access'))
  getMyStatistics(
    @Req() req: RequestWithUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    return this.statisticsService.getModeratorStatisticsByDateRange(
      req.user.id,
      startDate,
      endDate,
      forceRefresh === 'true',
    );
  }

  @Get('tiktok-user/:id')
  @UseGuards(AuthGuard('jwt-access'))
  getTikTokUserStatistics(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    return this.statisticsService.getTikTokUserStatisticsByDateRange(
      id,
      startDate,
      endDate,
      forceRefresh === 'true',
    );
  }

  @Get('admin/tiktok-users')
  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  getAdminTikTokUsersStatistics(@Query() query: StatisticsPeriodDto) {
    return this.statisticsService.getAdminTikTokUsersStatistics(query);
  }

  @Get('admin/tiktok-users/:id')
  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  getAdminTikTokUserStatisticsByPeriod(
    @Param('id') id: string,
    @Query() query: StatisticsPeriodDto,
  ) {
    return this.statisticsService.getAdminTikTokUserStatisticsByPeriod(
      id,
      query,
    );
  }

  @Get('admin/moderators')
  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  getAdminModeratorsStatistics(@Query() query: StatisticsPeriodDto) {
    return this.statisticsService.getAdminModeratorsStatistics(query);
  }

  @Get('admin/moderators/:id')
  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  getAdminModeratorStatisticsByPeriod(
    @Param('id') id: string,
    @Query() query: StatisticsPeriodDto,
  ) {
    return this.statisticsService.getAdminModeratorStatisticsByPeriod(
      id,
      query,
    );
  }
}
