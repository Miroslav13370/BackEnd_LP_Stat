import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

import {
  InstagramAuthService,
  InstagramEditorJwtPayload,
} from './instagram-auth.service';
import {
  InstagramEditorAuthDto,
  RegisterInstagramEditorWithAccountDto,
} from './dto/instagram-auth.dto';

@Controller('instagram-auth')
export class InstagramAuthController {
  constructor(private readonly instagramAuthService: InstagramAuthService) {}

  @Post('register')
  register(
    @Body() dto: InstagramEditorAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.instagramAuthService.register(dto, res);
  }

  @Post('login')
  login(
    @Body() dto: InstagramEditorAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.instagramAuthService.login(dto, res);
  }

  @Post('register-with-account')
  registerWithAccount(
    @Body() dto: RegisterInstagramEditorWithAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.instagramAuthService.registerWithAccount(dto, res);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as InstagramEditorJwtPayload;
    return this.instagramAuthService.me(user.id);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as InstagramEditorJwtPayload;
    return this.instagramAuthService.logout(user.id, res);
  }
}
