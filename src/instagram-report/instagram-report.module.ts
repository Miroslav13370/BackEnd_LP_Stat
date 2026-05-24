import { Module } from '@nestjs/common';

import { InstagramAuthModule } from 'src/instagram-auth/instagram-auth.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstagramReportController } from './instagram-report.controller';
import { InstagramReportService } from './instagram-report.service';

@Module({
  imports: [InstagramAuthModule],
  controllers: [InstagramReportController],
  providers: [InstagramReportService, PrismaService],
  exports: [InstagramReportService],
})
export class InstagramReportModule {}
