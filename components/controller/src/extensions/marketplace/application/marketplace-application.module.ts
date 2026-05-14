import { Module } from '@nestjs/common';
import { MarketplaceExtensionDomainModule } from '../domain/marketplace-domain.module';
import { WalletModule } from '~/application/wallet/wallet.module';
import { CategoryTreeResolver } from './resolvers/category-tree.resolver';
import { AttributeResolver } from './resolvers/attribute.resolver';
import { AvailableCategoryAdminResolver } from './resolvers/available-category-admin.resolver';
import { RequestResolver } from './resolvers/request.resolver';
import { MarketplaceMembershipResolver } from './resolvers/marketplace-membership.resolver';
import { MarketplaceOnboardingResolver } from './resolvers/marketplace-onboarding.resolver';
import { MarketplaceMemberWalletResolver } from './resolvers/marketplace-member-wallet.resolver';
import { MarketplaceCoopAcceptanceResolver } from './resolvers/marketplace-coop-acceptance.resolver';
import { MarketplaceRegistrationOfferResolver } from './resolvers/marketplace-registration-offer.resolver';
import { MarketplaceMembershipGuard } from './guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from './guards/marketplace-role.guard';
import { MarketplaceOnboardingService } from './onboarding/marketplace-onboarding.service';
import { MarketplaceCoopAcceptanceService } from './coop-acceptance/marketplace-coop-acceptance.service';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from './services/category-tree.service';

/**
 * Модуль приложения marketplace
 * Содержит GraphQL резолверы и сервисы приложения
 */
@Module({
  imports: [MarketplaceExtensionDomainModule, WalletModule],
  providers: [
    // GraphQL резолверы
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    MarketplaceOnboardingResolver,
    MarketplaceMemberWalletResolver,
    MarketplaceCoopAcceptanceResolver,
    MarketplaceRegistrationOfferResolver,

    // Guards (Story 1.3 / Story 1.6)
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,

    // Сервисы приложения
    {
      provide: CATEGORY_TREE_SERVICE,
      useClass: CategoryTreeService,
    },
    CategoryTreeService,
    MarketplaceOnboardingService,
    MarketplaceCoopAcceptanceService,
  ],
  exports: [
    // Экспортируем сервисы для использования в других модулях
    CATEGORY_TREE_SERVICE,
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,
    MarketplaceOnboardingService,
    MarketplaceCoopAcceptanceService,

    // Экспортируем резолверы для регистрации в GraphQL
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    MarketplaceOnboardingResolver,
    MarketplaceMemberWalletResolver,
    MarketplaceCoopAcceptanceResolver,
    MarketplaceRegistrationOfferResolver,
  ],
})
export class MarketplaceExtensionApplicationModule {}
