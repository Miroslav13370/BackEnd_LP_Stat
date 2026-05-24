import { Module } from '@nestjs/common';
import { YoutubeStatisticsService } from './youtube-statistics.service';
import { YoutubeStatisticsController } from './youtube-statistics.controller';

@Module({
  controllers: [YoutubeStatisticsController],
  providers: [YoutubeStatisticsService],
  exports: [YoutubeStatisticsService],
})
export class YoutubeStatisticsModule {}
