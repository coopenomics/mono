import { Module } from '@nestjs/common';
import { MarketplaceResolver } from './resolvers/marketplace.resolver';
import { MarketplaceService } from './services/marketplace.service';
import { MarketplaceInteractor } from './interactors/marketplace.interactor';
import { MarketplaceDomainModule } from '~/domain/marketplace/marketplace.module';
import { DocumentDomainModule } from '~/domain/document/document.module';

@Module({
  imports: [MarketplaceDomainModule, DocumentDomainModule],
  providers: [MarketplaceInteractor, MarketplaceResolver, MarketplaceService],
  exports: [],
})
export class MarketplaceModule {}
