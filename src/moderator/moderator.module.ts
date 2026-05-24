import { Module } from '@nestjs/common';
import { ModeratorService } from './moderator.service';
import { ModeratorController } from './moderator.controller';
import { AccessStrategy } from 'src/auth/strategies/access.strategy';

@Module({
  controllers: [ModeratorController],
  providers: [ModeratorService, AccessStrategy],
  exports: [ModeratorService],
})
export class ModeratorModule {}
