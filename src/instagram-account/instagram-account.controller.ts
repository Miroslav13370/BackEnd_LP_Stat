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

import { InstagramEditorJwtPayload } from 'src/instagram-auth/instagram-auth.service';
import {
  ConnectInstagramEditorDto,
  AddInstagramAccountByModeratorDto,
  CreateInstagramAccountDto,
  UpdateInstagramAuthorContentDto,
  UpdateInstagramModeratorDto,
} from './dto/instagram-account.dto';
import { InstagramAccountService } from './instagram-account.service';

type ModeratorJwtPayload = {
  id: string;
  login: string;
  isAdmin?: boolean;
};

@Controller('instagram-account')
export class InstagramAccountController {
  constructor(
    private readonly instagramAccountService: InstagramAccountService,
  ) {}

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Post()
  create(@Req() req: Request, @Body() dto: CreateInstagramAccountDto) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramAccountService.create(user.id, dto);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Get('my')
  getMyAccounts(@Req() req: Request) {
    const user = req.user as InstagramEditorJwtPayload;

    return this.instagramAccountService.getMyAccounts(user.id);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('by-moderator')
  createForModerator(
    @Req() req: Request,
    @Body() dto: AddInstagramAccountByModeratorDto,
  ) {
    const user = req.user as ModeratorJwtPayload;

    return this.instagramAccountService.createForModerator(user.id, dto);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Post('connect-editor')
  connectEditorAccountsToModerator(
    @Req() req: Request,
    @Body() dto: ConnectInstagramEditorDto,
  ) {
    const moderator = req.user as ModeratorJwtPayload;

    return this.instagramAccountService.connectEditorAccountsToModerator(
      moderator.id,
      dto,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Patch('editor/:editorId/moderator')
  updateEditorAccountsModerator(
    @Param('editorId') editorId: string,
    @Body() dto: UpdateInstagramModeratorDto,
  ) {
    return this.instagramAccountService.updateEditorAccountsModerator(
      editorId,
      dto,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Patch('editor/:editorId/disconnect')
  disconnectEditorAccountsFromModerator(@Param('editorId') editorId: string) {
    return this.instagramAccountService.disconnectEditorAccountsFromModerator(
      editorId,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Patch('editor/:editorId/author-content')
  updateEditorAccountsAuthorContent(
    @Param('editorId') editorId: string,
    @Body() dto: UpdateInstagramAuthorContentDto,
  ) {
    return this.instagramAccountService.updateEditorAccountsAuthorContent(
      editorId,
      dto,
    );
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Patch(':id/moderator')
  updateAccountModerator(
    @Param('id') id: string,
    @Body() dto: UpdateInstagramModeratorDto,
  ) {
    return this.instagramAccountService.updateAccountModerator(id, dto);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Patch(':id/author-content')
  updateAuthorContent(
    @Param('id') id: string,
    @Body() dto: UpdateInstagramAuthorContentDto,
  ) {
    return this.instagramAccountService.updateAuthorContent(id, dto);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Patch(':id/disconnect')
  disconnectAccountFromModerator(@Param('id') id: string) {
    return this.instagramAccountService.disconnectAccountFromModerator(id);
  }

  @UseGuards(AuthGuard('jwt-access'))
  @Delete(':id')
  deleteAccount(@Param('id') id: string) {
    return this.instagramAccountService.deleteAccount(id);
  }

  @UseGuards(AuthGuard('instagram-editor-access'))
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.instagramAccountService.getById(id);
  }
}
