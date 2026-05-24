import { Module } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { UserModule } from 'src/user/user.module';
import { YoutubeStatisticsModule } from 'src/youtube-statistics/youtube-statistics.module';

@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService],
  imports: [UserModule, YoutubeStatisticsModule],
})
export class StatisticsModule {}
