import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { StatisticsModule } from './statistics/statistics.module';
import { ModeratorModule } from './moderator/moderator.module';

import { YoutubeStatisticsModule } from './youtube-statistics/youtube-statistics.module';
import { YouTubeUserModule } from './you-tube-user/you-tube-user.module';

import { InstagramStatisticsModule } from './instagram-statistics/instagram-statistics.module';
import { InstagramUserModule } from './instagram-user/instagram-user.module';

import { InstagramAuthModule } from './instagram-auth/instagram-auth.module';
import { InstagramAccountModule } from './instagram-account/instagram-account.module';
import { InstagramReportModule } from './instagram-report/instagram-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    PrismaModule,

    AuthModule,
    UserModule,
    ModeratorModule,

    StatisticsModule,

    YoutubeStatisticsModule,
    YouTubeUserModule,

    InstagramStatisticsModule,
    InstagramUserModule,

    InstagramAuthModule,
    InstagramAccountModule,
    InstagramReportModule,
  ],
})
export class AppModule {}
