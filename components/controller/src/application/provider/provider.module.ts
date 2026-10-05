import { Module } from '@nestjs/common';
import { ProviderService } from './services/provider.service';
import { ProviderResolver } from './resolvers/provider.resolver';
import { ConfigModule } from '@nestjs/config';
import { DocumentDomainModule } from '~/domain/document/document.module';
// Импортируем для регистрации GraphQL enum
import '~/domain/instance-status.enum';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [CoreRightsModule, ConfigModule, DocumentDomainModule],
  providers: [ProviderService, ProviderResolver],
  exports: [ProviderService],
})
export class ProviderModule {}
