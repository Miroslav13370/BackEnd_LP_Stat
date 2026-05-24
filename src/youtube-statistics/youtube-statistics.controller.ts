import { Controller } from '@nestjs/common';
import { YoutubeStatisticsService } from './youtube-statistics.service';

@Controller('youtube-statistics')
export class YoutubeStatisticsController {
  constructor(
    private readonly youtubeStatisticsService: YoutubeStatisticsService,
  ) {}
}
