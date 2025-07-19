import { Module } from '@nestjs/common';
import { MarketplaceDomainModule } from '../domain/marketplace-domain.module';
import { CategoryTreeResolver } from './resolvers/category-tree.resolver';
import { AttributeResolver } from './resolvers/attribute.resolver';
import { AvailableCategoryAdminResolver } from './resolvers/available-category-admin.resolver';
import { RequestResolver } from './resolvers/request.resolver';
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
    RequestResolver,

    // Сервисы приложения
    {
      provide: CATEGORY_TREE_SERVICE,
      useClass: CategoryTreeService,
    },
    CategoryTreeService,
  ],
  exports: [
    // Экспортируем сервисы для использования в других модулях
    CATEGORY_TREE_SERVICE,

    // Экспортируем резолверы для регистрации в GraphQL
    CategoryTreeResolver,
    AttributeResolver,
    AvailableCategoryAdminResolver,
    RequestResolver,
  ],
})
export class MarketplaceApplicationModule {}
