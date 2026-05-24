import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { AdminGuard } from 'src/auth/strategies/admin.strategy';
import { JwtPayload } from 'src/auth/strategies/refresh.strategy';
import { YouTubeUserService } from './you-tube-user.service';

type UpdateYouTubeAuthorContentDto = {
  youtubeUserId: string;
  isAuthorContent: boolean;
};

@Controller('youtube-user')
export class YouTubeUserController {
  constructor(private readonly youTubeUserService: YouTubeUserService) {}

  @Get('by-id/:id')
  getById(@Param('id') id: string) {
    return this.youTubeUserService.getById(id);
  }

  @Get('all')
  getAllNotConnect() {
    return this.youTubeUserService.getAllNotConnect();
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('updateAuthorContent')
  updateAuthorContent(
    @Body() dto: UpdateYouTubeAuthorContentDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;

    return this.youTubeUserService.updateAuthorContent(user.id, dto);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Delete('delete-byId/:youtubeUserId')
  delete(@Param('youtubeUserId') youtubeUserId: string, @Req() req: Request) {
    const admin = req.user as JwtPayload;

    return this.youTubeUserService.delete(admin.id, youtubeUserId);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Patch('update-moderator/:youtubeUserId')
  updateModerator(
    @Param('youtubeUserId') youtubeUserId: string,
    @Body() body: { moderatorId: string | null },
    @Req() req: Request,
  ) {
    const admin = req.user as JwtPayload;

    return this.youTubeUserService.updateModerator(
      admin.id,
      youtubeUserId,
      body.moderatorId,
    );
  }
  @Get('debug/:id')
  debugById(@Param('id') id: string) {
    return this.youTubeUserService.debugById(id);
  }
}
