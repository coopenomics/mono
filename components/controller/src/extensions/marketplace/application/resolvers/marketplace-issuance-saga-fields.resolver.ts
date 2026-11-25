import { Injectable } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { MarketplaceIssuanceSagaDTO } from '../dto/marketplace-issuance-saga.dto';
import type { MarketplaceOrderDisplayFields } from '../dto/marketplace-order.dto';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';

/**
 * Товар в ходе выдачи (99D-18): название и снимок по заказу. Пайщик на экране
 * подписи акта видел «Заказ №…» и серый значок вместо того, что получает.
 * Поля вычисляются по запросу клиента, поэтому все запросы хода выдачи
 * получают товар без правки каждого. Оба поля одного хода читают заказ один
 * раз: обещание кэшируется на объекте ответа и живёт, пока живёт ответ.
 */
@Resolver(() => MarketplaceIssuanceSagaDTO)
@Injectable()
export class MarketplaceIssuanceSagaFieldsResolver {
  private readonly cache = new WeakMap<object, Promise<MarketplaceOrderDisplayFields>>();

  constructor(private readonly display: MarketplaceOrderDisplayService) {}

  private displayOf(saga: MarketplaceIssuanceSagaDTO): Promise<MarketplaceOrderDisplayFields> {
    let pending = this.cache.get(saga);
    if (!pending) {
      pending = this.display
        .enrichByOrderIds([saga.order_id])
        .then((map) => map.get(saga.order_id) ?? {});
      this.cache.set(saga, pending);
    }
    return pending;
  }

  @ResolveField('product_name', () => String, { nullable: true, description: 'Название товара по заказу.' })
  async productName(@Parent() saga: MarketplaceIssuanceSagaDTO): Promise<string | null> {
    return (await this.displayOf(saga)).product_name ?? null;
  }

  @ResolveField('image_url', () => String, {
    nullable: true,
    description: 'Обложка товара — первое изображение предложения; пусто, если изображений нет.',
  })
  async imageUrl(@Parent() saga: MarketplaceIssuanceSagaDTO): Promise<string | null> {
    return (await this.displayOf(saga)).image_url ?? null;
  }
}
