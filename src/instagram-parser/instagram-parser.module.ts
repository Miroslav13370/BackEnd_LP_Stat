import { Module } from '@nestjs/common';

import { InstagramParserService } from './instagram-parser.service';

@Module({
  providers: [InstagramParserService],
  exports: [InstagramParserService],
})
export class InstagramParserModule {}
