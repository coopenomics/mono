import { Module } from '@nestjs/common';
import { ShareResolver } from './resolvers/share.resolver';

@Module({
  providers: [ShareResolver],
})
export class ShareAppModule {}
