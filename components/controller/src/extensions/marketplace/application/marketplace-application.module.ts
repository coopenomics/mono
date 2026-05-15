import { Module } from '@nestjs/common';
import { MarketplaceExtensionDomainModule } from '../domain/marketplace-domain.module';
import { CategoryTreeResolver } from './resolvers/category-tree.resolver';
import { AttributeResolver } from './resolvers/attribute.resolver';
import { AvailableCategoryAdminResolver } from './resolvers/available-category-admin.resolver';
import { RequestResolver } from './resolvers/request.resolver';
import { MarketplaceMembershipResolver } from './resolvers/marketplace-membership.resolver';
import { KuDetailsResolver } from './resolvers/ku-details.resolver';
import { MarketplaceOnboardingResolver } from './resolvers/marketplace-onboarding.resolver';
import { MarketplaceMemberWalletResolver } from './resolvers/marketplace-member-wallet.resolver';
import { MarketplaceCoopAcceptanceResolver } from './resolvers/marketplace-coop-acceptance.resolver';
import { MarketplaceRegistrationOfferResolver } from './resolvers/marketplace-registration-offer.resolver';
import { MarketplaceWhitelistResolver } from './resolvers/marketplace-whitelist.resolver';
import { MarketplaceVitrineResolver } from './resolvers/marketplace-vitrine.resolver';
import { MarketplaceOfferResolver } from './resolvers/marketplace-offer.resolver';
import { MarketplaceModerationResolver } from './resolvers/marketplace-moderation.resolver';
import { MarketplaceMembershipGuard } from './guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from './guards/marketplace-role.guard';
import { MarketplaceOnboardingService } from './onboarding/marketplace-onboarding.service';
import { MarketplaceCoopAcceptanceService } from './coop-acceptance/marketplace-coop-acceptance.service';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from './services/category-tree.service';
import { KuDetailsService } from './services/ku-details.service';
import {
  MarketplaceWhitelistService,
  MARKETPLACE_WHITELIST_SERVICE,
} from './services/marketplace-whitelist.service';
import {
  MarketplaceVitrineService,
  MARKETPLACE_VITRINE_SERVICE,
} from './services/marketplace-vitrine.service';
import {
  MarketplaceOfferService,
  MARKETPLACE_OFFER_SERVICE,
} from './services/marketplace-offer.service';
import {
  MarketplaceCategoryService,
  MARKETPLACE_CATEGORY_SERVICE,
} from './services/marketplace-category.service';
import {
  MarketplaceModerationService,
  MARKETPLACE_MODERATION_SERVICE,
} from './services/marketplace-moderation.service';

/**
 * Модуль приложения marketplace
 * Содержит GraphQL резолверы и сервисы приложения
 */
@Module({
  imports: [MarketplaceExtensionDomainModule],
  providers: [
    // GraphQL резолверы
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    KuDetailsResolver,
    MarketplaceOnboardingResolver,
    MarketplaceMemberWalletResolver,
    MarketplaceCoopAcceptanceResolver,
    MarketplaceRegistrationOfferResolver,
    MarketplaceWhitelistResolver,
    MarketplaceVitrineResolver,
    MarketplaceOfferResolver,
    MarketplaceModerationResolver,

    // Guards (Story 1.3 / Story 1.6)
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,

    // Сервисы приложения
    {
      provide: CATEGORY_TREE_SERVICE,
      useClass: CategoryTreeService,
    },
    CategoryTreeService,
    KuDetailsService,
    MarketplaceOnboardingService,
    MarketplaceCoopAcceptanceService,
    // Story 3.1
    {
      provide: MARKETPLACE_WHITELIST_SERVICE,
      useClass: MarketplaceWhitelistService,
    },
    MarketplaceWhitelistService,
    {
      provide: MARKETPLACE_VITRINE_SERVICE,
      useClass: MarketplaceVitrineService,
    },
    MarketplaceVitrineService,
    // Story 3.2
    {
      provide: MARKETPLACE_OFFER_SERVICE,
      useClass: MarketplaceOfferService,
    },
    MarketplaceOfferService,
    {
      provide: MARKETPLACE_CATEGORY_SERVICE,
      useClass: MarketplaceCategoryService,
    },
    MarketplaceCategoryService,
    // Story 3.3
    {
      provide: MARKETPLACE_MODERATION_SERVICE,
      useClass: MarketplaceModerationService,
    },
    MarketplaceModerationService,
  ],
  exports: [
    // Экспортируем сервисы для использования в других модулях
    CATEGORY_TREE_SERVICE,
    MarketplaceMembershipGuard,
    MarketplaceRoleGuard,
    KuDetailsService,
    MarketplaceOnboardingService,
    MarketplaceCoopAcceptanceService,
    MARKETPLACE_WHITELIST_SERVICE,
    MarketplaceWhitelistService,
    MARKETPLACE_VITRINE_SERVICE,
    MarketplaceVitrineService,
    MARKETPLACE_OFFER_SERVICE,
    MarketplaceOfferService,
    MARKETPLACE_CATEGORY_SERVICE,
    MarketplaceCategoryService,
    MARKETPLACE_MODERATION_SERVICE,
    MarketplaceModerationService,

    // Экспортируем резолверы для регистрации в GraphQL
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    KuDetailsResolver,
    MarketplaceOnboardingResolver,
    MarketplaceMemberWalletResolver,
    MarketplaceCoopAcceptanceResolver,
    MarketplaceRegistrationOfferResolver,
    MarketplaceWhitelistResolver,
    MarketplaceVitrineResolver,
    MarketplaceOfferResolver,
    MarketplaceModerationResolver,
  ],
})
export class MarketplaceExtensionApplicationModule {}
