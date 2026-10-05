import { Module } from '@nestjs/common';
import { AppManagementService } from './services/extension.service';
import { ExtensionDomainModule } from '~/domain/extension/extension-domain.module';
import { AppStoreResolver } from './resolvers/extension.resolver';
import { ExtensionInteractor } from './interactors/extension.interactor';
import { ExtensionListingInteractor } from './interactors/extension-listing.interactor';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [
    CoreRightsModule,
    ExtensionDomainModule, // Импортируем доменный модуль
  ],
  controllers: [],
  providers: [AppManagementService, AppStoreResolver, ExtensionInteractor, ExtensionListingInteractor],
  exports: [AppManagementService, ExtensionInteractor, ExtensionListingInteractor],
})
export class AppStoreModule {}
