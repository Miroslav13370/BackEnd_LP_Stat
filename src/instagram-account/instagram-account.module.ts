import { Module } from '@nestjs/common';

import { InstagramAuthModule } from 'src/instagram-auth/instagram-auth.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstagramAccountController } from './instagram-account.controller';
import { InstagramAccountService } from './instagram-account.service';

@Module({
  imports: [InstagramAuthModule],
  controllers: [InstagramAccountController],
  providers: [InstagramAccountService, PrismaService],
  exports: [InstagramAccountService],
})
export class InstagramAccountModule {}
