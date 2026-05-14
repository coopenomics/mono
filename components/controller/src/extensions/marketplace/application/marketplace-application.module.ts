import { Module } from '@nestjs/common';
import { MarketplaceExtensionDomainModule } from '../domain/marketplace-domain.module';
import { CategoryTreeResolver } from './resolvers/category-tree.resolver';
import { AttributeResolver } from './resolvers/attribute.resolver';
import { AvailableCategoryAdminResolver } from './resolvers/available-category-admin.resolver';
import { RequestResolver } from './resolvers/request.resolver';
import { MarketplaceMembershipResolver } from './resolvers/marketplace-membership.resolver';
import { MarketplaceOnboardingResolver } from './resolvers/marketplace-onboarding.resolver';
import { MarketplaceMembershipGuard } from './guards/marketplace-membership.guard';
import { MarketplaceOnboardingService } from './onboarding/marketplace-onboarding.service';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from './services/category-tree.service';

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
    MarketplaceOnboardingResolver,

    // Guards (Story 1.3)
    MarketplaceMembershipGuard,

    // Сервисы приложения
    {
      provide: CATEGORY_TREE_SERVICE,
      useClass: CategoryTreeService,
    },
    CategoryTreeService,
    MarketplaceOnboardingService,
  ],
  exports: [
    // Экспортируем сервисы для использования в других модулях
    CATEGORY_TREE_SERVICE,
    MarketplaceMembershipGuard,
    MarketplaceOnboardingService,

    // Экспортируем резолверы для регистрации в GraphQL
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
    MarketplaceMembershipResolver,
    MarketplaceOnboardingResolver,
  ],
})
export class MarketplaceExtensionApplicationModule {}
