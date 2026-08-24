import { Module } from '@nestjs/common';
import { ProviderService } from './services/provider.service';
import { CooperativeCharterService } from './services/cooperative-charter.service';
import { ProviderResolver } from './resolvers/provider.resolver';
import { ConfigModule } from '@nestjs/config';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { BlockchainModule } from '~/infrastructure/blockchain/blockchain.module';
import { bucketProvidersFor } from '@coopenomics/extension-kit';
import { FILE_STORAGE_PORT } from '@coopenomics/innercoop';
// Импортируем для регистрации GraphQL enum
import '~/domain/instance-status.enum';

@Module({
  imports: [ConfigModule, DocumentDomainModule, BlockchainModule],
  providers: [
    // Устав кооператива (registrator:charters) — бакет по @UseBucket.
    ...bucketProvidersFor(FILE_STORAGE_PORT, [CooperativeCharterService]),
    ProviderService,
    CooperativeCharterService,
    ProviderResolver,
  ],
  exports: [ProviderService, CooperativeCharterService],
})
export class ProviderModule {}
