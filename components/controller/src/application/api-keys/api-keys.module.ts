import { Module } from '@nestjs/common';
import { ApiKeyResolver } from './resolvers/api-key.resolver';

@Module({
  providers: [ApiKeyResolver],
})
export class ApiKeysAppModule {}
