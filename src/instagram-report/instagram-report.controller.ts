import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { AdminGuard } from 'src/auth/strategies/admin.strategy';
import { JwtPayload } from 'src/auth/strategies/refresh.strategy';
import { InstagramEditorJwtPayload } from 'src/instagram-auth/instagram-auth.service';
import {
  CreateInstagramMetricsReportDto,
  CreateInstagramViralVideosReportDto,
  RejectInstagramReportDto,
  UpdateInstagramMetricsReportDto,
  UpdateInstagramViralVideosReportDto,
} from './dto/instagram-report.dto';
import { InstagramReportService } from './instagram-report.service';

@Controller('instagram-report')
export class InstagramReportController {
  constructor(
    private readonly instagramReportService: InstagramReportService,
  ) {}

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Post('metrics')
  createMetricsReport(
    @Req() req: Request,
    @Body() dto: CreateInstagramMetricsReportDto,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.createMetricsReport(user.id, dto);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Post('viral-videos')
  createViralVideosReport(
    @Req() req: Request,
    @Body() dto: CreateInstagramViralVideosReportDto,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.createViralVideosReport(user.id, dto);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Get('metrics/my')
  getMyMetricsReports(
    @Req() req: Request,
    @Query('instagramAccountId') instagramAccountId?: string,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.getMyMetricsReports(
      user.id,
      instagramAccountId,
    );
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Get('viral-videos/my')
  getMyViralVideosReports(
    @Req() req: Request,
    @Query('instagramAccountId') instagramAccountId?: string,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.getMyViralVideosReports(
      user.id,
      instagramAccountId,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Get('metrics/pending')
  getPendingMetricsReports(@Req() req: Request) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.getPendingMetricsReports(user.id, false);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Get('viral-videos/pending')
  getPendingViralVideosReports(@Req() req: Request) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.getPendingViralVideosReports(
      user.id,
      false,
    );
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Get('admin/metrics/pending')
  getAllPendingMetricsReports(@Req() req: Request) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.getPendingMetricsReports(user.id, true);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Get('admin/viral-videos/pending')
  getAllPendingViralVideosReports(@Req() req: Request) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.getPendingViralVideosReports(
      user.id,
      true,
    );
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Patch('metrics/:reportId')
  updateMetricsReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
    @Body() dto: UpdateInstagramMetricsReportDto,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.updateMetricsReport(
      user.id,
      reportId,
      dto,
    );
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Patch('viral-videos/:reportId')
  updateViralVideosReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
    @Body() dto: UpdateInstagramViralVideosReportDto,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.updateViralVideosReport(
      user.id,
      reportId,
      dto,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('metrics/:reportId/verify')
  verifyMetricsReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.verifyMetricsReport(
      user.id,
      reportId,
      false,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('viral-videos/:reportId/verify')
  verifyViralVideosReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.verifyViralVideosReport(
      user.id,
      reportId,
      false,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('metrics/:reportId/reject')
  rejectMetricsReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
    @Body() dto: RejectInstagramReportDto,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.rejectMetricsReport(
      user.id,
      reportId,
      dto,
      false,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('viral-videos/:reportId/reject')
  rejectViralVideosReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
    @Body() dto: RejectInstagramReportDto,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.rejectViralVideosReport(
      user.id,
      reportId,
      dto,
      false,
    );
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/metrics/:reportId/verify')
  verifyMetricsReportAsAdmin(
    @Req() req: Request,
    @Param('reportId') reportId: string,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.verifyMetricsReport(
      user.id,
      reportId,
      true,
    );
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/viral-videos/:reportId/verify')
  verifyViralVideosReportAsAdmin(
    @Req() req: Request,
    @Param('reportId') reportId: string,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.verifyViralVideosReport(
      user.id,
      reportId,
      true,
    );
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/metrics/:reportId/reject')
  rejectMetricsReportAsAdmin(
    @Req() req: Request,
    @Param('reportId') reportId: string,
    @Body() dto: RejectInstagramReportDto,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.rejectMetricsReport(
      user.id,
      reportId,
      dto,
      true,
    );
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/viral-videos/:reportId/reject')
  rejectViralVideosReportAsAdmin(
    @Req() req: Request,
    @Param('reportId') reportId: string,
    @Body() dto: RejectInstagramReportDto,
  ) {
    const user = req.user as JwtPayload;

    return this.instagramReportService.rejectViralVideosReport(
      user.id,
      reportId,
      dto,
      true,
    );
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Delete('metrics/:reportId')
  deleteMetricsReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.deleteMetricsReport(user.id, reportId);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Delete('viral-videos/:reportId')
  deleteViralVideosReport(
    @Req() req: Request,
    @Param('reportId') reportId: string,
  ) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramReportService.deleteViralVideosReport(
      user.id,
      reportId,
    );
  }
}
