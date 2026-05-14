import { Module } from '@nestjs/common';
import { ExtensionDomainModule } from '~/domain/extension/extension-domain.module';
import { ExtensionInteractor } from '../interactors/extension.interactor';
import { ExtensionListingInteractor } from '../interactors/extension-listing.interactor';

@Module({
  imports: [ExtensionDomainModule],
  providers: [ExtensionInteractor, ExtensionListingInteractor],
  exports: [ExtensionInteractor, ExtensionListingInteractor],
})
export class ExtensionAppModule {}
