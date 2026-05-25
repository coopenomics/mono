import { Module } from '@nestjs/common';
import { ProviderService } from './services/provider.service';
import { ProviderResolver } from './resolvers/provider.resolver';
import { ConfigModule } from '@nestjs/config';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { BlockchainModule } from '~/infrastructure/blockchain/blockchain.module';
// Импортируем для регистрации GraphQL enum
import '~/domain/instance-status.enum';

@Module({
  imports: [ConfigModule, DocumentDomainModule, BlockchainModule],
  providers: [ProviderService, ProviderResolver],
  exports: [ProviderService],
})
export class ProviderModule {}
