import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ModeratorModule } from 'src/moderator/moderator.module';
import { AccessStrategy } from 'src/auth/strategies/access.strategy';

@Module({
  controllers: [UserController],
  providers: [UserService, AccessStrategy],
  exports: [UserService],
  imports: [ModeratorModule],
})
export class UserModule {}
