import { Module } from '@nestjs/common';
import { ProductCardResolver } from './application/resolvers/product-card.resolver';
import { CategoryResolver } from './application/resolvers/category.resolver';

/**
 * Расширение Marketplace — бэкенд стола заказов.
 *
 * Содержит:
 * - Управление карточками товаров (CRUD, публикация, модерация)
 * - Управление категориями (дерево, CRUD)
 * - Связь с блокчейном при match (заявки на поставку)
 *
 * Не содержит пользовательского UI — для этого есть расширение marketplace (фронтенд).
 */
@Module({
  providers: [
    ProductCardResolver,
    CategoryResolver,
  ],
  exports: [],
})
export class MarketplaceCardsModule {}
