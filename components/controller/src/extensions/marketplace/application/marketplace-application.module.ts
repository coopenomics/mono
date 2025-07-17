import { Module } from '@nestjs/common';
import { MarketplaceDomainModule } from '../domain/marketplace-domain.module';
import { CategoryTreeResolver } from './resolvers/category-tree.resolver';
import { AttributeResolver } from './resolvers/attribute.resolver';
import { AvailableCategoryAdminResolver } from './resolvers/available-category-admin.resolver';
import { MarketplaceCategoryService } from './services/marketplace-category.service';
import { MarketplaceAttributeService } from './services/marketplace-attribute.service';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from './services/category-tree.service';

/**
 * Модуль приложения marketplace
 * Содержит GraphQL резолверы и сервисы приложения
 */
@Module({
  imports: [MarketplaceDomainModule],
  providers: [
    // GraphQL резолверы
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,

    // Сервисы приложения
    {
      provide: CATEGORY_TREE_SERVICE,
      useClass: CategoryTreeService,
    },
    CategoryTreeService,
    MarketplaceCategoryService,
    MarketplaceAttributeService,
  ],
  exports: [
    // Экспортируем сервисы для использования в других модулях
    MarketplaceCategoryService,
    MarketplaceAttributeService,
    CATEGORY_TREE_SERVICE,

    // Экспортируем резолверы для регистрации в GraphQL
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
  ],
})
export class MarketplaceApplicationModule {}
