import { Controller, Get } from '@nestjs/common';
import { InstagramUserService } from './instagram-user.service';

@Controller('instagram-user')
export class InstagramUserController {
  constructor(private readonly instagramUserService: InstagramUserService) {}

  @Get('all')
  getAll() {
    return this.instagramUserService.getAll();
  }
}
