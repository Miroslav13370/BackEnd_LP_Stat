import { Module } from '@nestjs/common';
import { InstagramStatisticsService } from './instagram-statistics.service';
import { InstagramStatisticsController } from './instagram-statistics.controller';

@Module({
  controllers: [InstagramStatisticsController],
  providers: [InstagramStatisticsService],
})
export class InstagramStatisticsModule {}
