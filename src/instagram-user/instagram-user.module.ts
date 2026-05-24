import { Module } from '@nestjs/common';
import { InstagramUserService } from './instagram-user.service';
import { InstagramUserController } from './instagram-user.controller';

@Module({
  controllers: [InstagramUserController],
  providers: [InstagramUserService],
  exports: [InstagramUserService],
})
export class InstagramUserModule {}
