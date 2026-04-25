// domain/appstore/appstore-domain.module.ts

import { Module } from '@nestjs/common';
import { DocumentDomainModule } from '../document/document.module';

@Module({
  imports: [DocumentDomainModule],
  providers: [],
  exports: [],
})
export class MarketplaceDomainModule {}
