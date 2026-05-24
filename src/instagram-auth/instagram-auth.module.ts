import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaService } from 'src/prisma/prisma.service';
import { InstagramAuthController } from './instagram-auth.controller';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramEditorAccessStrategy } from './strategies/instagram-editor-access.strategy';

@Module({
  imports: [JwtModule.register({})],
  controllers: [InstagramAuthController],
  providers: [
    InstagramAuthService,
    InstagramEditorAccessStrategy,
    PrismaService,
  ],
  exports: [InstagramAuthService],
})
export class InstagramAuthModule {}
