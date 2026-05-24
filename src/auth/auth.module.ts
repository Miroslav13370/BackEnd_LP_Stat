import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModeratorModule } from 'src/moderator/moderator.module';
import { YouTubeUserModule } from 'src/you-tube-user/you-tube-user.module';
import { InstagramUserModule } from 'src/instagram-user/instagram-user.module';
import { RefreshStrategy } from './strategies/refresh.strategy';

@Module({
  controllers: [AuthController],
  providers: [AuthService, RefreshStrategy],
  exports: [AuthService],
  imports: [
    UserModule,
    ModeratorModule,
    YouTubeUserModule,
    InstagramUserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({}),
    }),
  ],
})
export class AuthModule {}
