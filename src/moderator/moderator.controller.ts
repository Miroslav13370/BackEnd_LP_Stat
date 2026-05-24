import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { AdminGuard } from 'src/auth/strategies/admin.strategy';
import { JwtPayload } from 'src/auth/strategies/refresh.strategy';
import { ModeratorService } from './moderator.service';

@Controller('moderator')
export class ModeratorController {
  constructor(private readonly moderatorService: ModeratorService) {}

  @UseGuards(AuthGuard('jwt-access'))
  @Get()
  getModeratorById(@Req() req: Request) {
    const user = req.user as JwtPayload;

    return this.moderatorService.getModeratorById(user.id);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Get('by-id/:id')
  getModeratorByIdAdmin(@Param('id') id: string) {
    return this.moderatorService.getModeratorById(id);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('connectTikTokUser')
  connectTikTokUser(
    @Req() req: Request,
    @Body() dto: { tikTokUsersIds: string[] },
  ) {
    const user = req.user as JwtPayload;

    return this.moderatorService.connectTikTokUser({
      id: user.id,
      tikTokUsersIds: dto.tikTokUsersIds,
    });
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/:moderatorId/connectTikTokUser')
  connectTikTokUserAdmin(
    @Param('moderatorId') moderatorId: string,
    @Body() dto: { tikTokUsersIds: string[] },
  ) {
    return this.moderatorService.connectTikTokUser({
      id: moderatorId,
      tikTokUsersIds: dto.tikTokUsersIds,
    });
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('connectYouTubeUser')
  connectYouTubeUser(
    @Req() req: Request,
    @Body() dto: { youTubeUsersIds: string[] },
  ) {
    const user = req.user as JwtPayload;

    return this.moderatorService.connectYouTubeUser({
      id: user.id,
      youTubeUsersIds: dto.youTubeUsersIds,
    });
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/:moderatorId/connectYouTubeUser')
  connectYouTubeUserAdmin(
    @Param('moderatorId') moderatorId: string,
    @Body() dto: { youTubeUsersIds: string[] },
  ) {
    return this.moderatorService.connectYouTubeUser({
      id: moderatorId,
      youTubeUsersIds: dto.youTubeUsersIds,
    });
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('disconnectTikTokUser/:userId')
  disconnectTikTokUser(@Req() req: Request, @Param('userId') userId: string) {
    const user = req.user as JwtPayload;

    return this.moderatorService.disconnectTikTokUser(user.id, userId);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/:moderatorId/disconnectTikTokUser/:userId')
  disconnectTikTokUserAdmin(
    @Param('moderatorId') moderatorId: string,
    @Param('userId') userId: string,
  ) {
    return this.moderatorService.disconnectTikTokUser(moderatorId, userId);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('disconnectYouTubeUser/:userId')
  disconnectYouTubeUser(@Req() req: Request, @Param('userId') userId: string) {
    const user = req.user as JwtPayload;

    return this.moderatorService.disconnectYouTubeUser(user.id, userId);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Post('admin/:moderatorId/disconnectYouTubeUser/:userId')
  disconnectYouTubeUserAdmin(
    @Param('moderatorId') moderatorId: string,
    @Param('userId') userId: string,
  ) {
    return this.moderatorService.disconnectYouTubeUser(moderatorId, userId);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Delete('delete-byId/:moderatorId')
  delete(@Param('moderatorId') moderatorId: string, @Req() req: Request) {
    const admin = req.user as JwtPayload;

    return this.moderatorService.delete(admin.id, moderatorId);
  }
}
