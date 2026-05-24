import { Controller, Get, Param } from '@nestjs/common';
import { InstagramStatisticsService } from './instagram-statistics.service';

@Controller('instagram-statistics')
export class InstagramStatisticsController {
  constructor(
    private readonly instagramStatisticsService: InstagramStatisticsService,
  ) {}

  @Get('admin/users')
  getAdminInstagramUsersStatistics() {
    return this.instagramStatisticsService.getAdminInstagramUsersStatistics();
  }

  @Get('user/:id')
  getInstagramUserStatistics(@Param('id') id: string) {
    return this.instagramStatisticsService.getInstagramUserStatistics(id);
  }
}
