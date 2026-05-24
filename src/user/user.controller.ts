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
import { UserService } from './user.service';
import { updateAuthorContentDto } from './dto/updateAuthorContent.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { JwtPayload } from 'src/auth/strategies/refresh.strategy';
import { AdminGuard } from 'src/auth/strategies/admin.strategy';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('by-id/:id')
  getById(@Param('id') id: string) {
    return this.userService.getById(id);
  }
  @Get('all')
  getAllNotConnect() {
    return this.userService.getAllNotConnect();
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('updateAuthorContent')
  updateAuthorContent(
    @Body() dto: updateAuthorContentDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.userService.updateAuthorContent(user.id, dto);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Delete('delete-byId/:tiktokUserId')
  delete(@Param('tiktokUserId') tiktokUserId: string, @Req() req: Request) {
    const admin = req.user as JwtPayload;
    return this.userService.delete(admin.id, tiktokUserId);
  }

  @UseGuards(AuthGuard('jwt-access'), AdminGuard)
  @Patch('update-moderator/:tiktokUserId')
  updateModerator(
    @Param('tiktokUserId') tiktokUserId: string,
    @Body() body: { moderatorId: string | null },
    @Req() req: Request,
  ) {
    const admin = req.user as JwtPayload;

    return this.userService.updateModerator(
      admin.id,
      tiktokUserId,
      body.moderatorId,
    );
  }
}
