import { Module } from '@nestjs/common';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from './services/category-tree-domain.service';
import {
  AvailableCategoryDomainService,
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
} from './services/available-category-domain.service';
import { MarketplaceInfrastructureModule } from '../infrastructure/marketplace-infrastructure.module';

/**
 * Доменный модуль marketplace
 * Содержит бизнес-логику и правила для работы с категориями, типами товаров и атрибутами
 *
 * Принцип инверсии зависимостей (DIP):
 * - Домен определяет интерфейсы репозиториев (абстракции)
 * - Инфраструктура реализует эти интерфейсы (детали)
 * - Импорт инфраструктуры нужен только для DI контейнера NestJS
 */
@Module({
  imports: [
    MarketplaceInfrastructureModule, // Предоставляет реализации доменных интерфейсов
  ],
  providers: [
    {
      provide: CATEGORY_TREE_DOMAIN_SERVICE,
      useClass: CategoryTreeDomainService,
    },
    CategoryTreeDomainService,
    {
      provide: AVAILABLE_CATEGORY_DOMAIN_SERVICE,
      useClass: AvailableCategoryDomainService,
    },
    AvailableCategoryDomainService,
  ],
  exports: [
    CategoryTreeDomainService,
    CATEGORY_TREE_DOMAIN_SERVICE,
    AvailableCategoryDomainService,
    AVAILABLE_CATEGORY_DOMAIN_SERVICE,
  ],
})
export class MarketplaceExtensionDomainModule {}
