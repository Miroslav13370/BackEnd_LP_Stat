import { Module } from '@nestjs/common';
import { YouTubeUserService } from './you-tube-user.service';
import { YouTubeUserController } from './you-tube-user.controller';
import { ModeratorModule } from 'src/moderator/moderator.module';

@Module({
  controllers: [YouTubeUserController],
  providers: [YouTubeUserService],
  imports: [ModeratorModule],
  exports: [YouTubeUserService],
})
export class YouTubeUserModule {}
