import { Injectable } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { MarketplaceInventoryItemDTO } from '../dto/marketplace-inventory.dto';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';

/**
 * Снимок товара у позиции склада (99D-18): панель содержимого бокса и другие
 * списки склада показывали название без снимка. Поле вычисляется только по
 * запросу клиента. Списки склада длинные, поэтому запросы одного ответа
 * собираются в пачку: все позиции, запрошенные в одном такте, получают
 * обложки одним чтением заказов и предложений.
 */
@Resolver(() => MarketplaceInventoryItemDTO)
@Injectable()
export class MarketplaceInventoryItemFieldsResolver {
  private pending = new Map<string, Array<(url: string | null) => void>>();
  private scheduled = false;

  constructor(private readonly display: MarketplaceOrderDisplayService) {}

  private coverOf(orderId: string): Promise<string | null> {
    return new Promise((resolve) => {
      const waiters = this.pending.get(orderId) ?? [];
      waiters.push(resolve);
      this.pending.set(orderId, waiters);
      if (!this.scheduled) {
        this.scheduled = true;
        setImmediate(() => void this.flush());
      }
    });
  }

  private async flush(): Promise<void> {
    const batch = this.pending;
    this.pending = new Map();
    this.scheduled = false;
    let covers = new Map<string, string>();
    try {
      covers = await this.display.coverImagesByOrderIds([...batch.keys()]);
    } catch {
      // Снимок — украшение строки: сбой чтения не роняет список склада.
    }
    for (const [orderId, waiters] of batch) {
      for (const resolve of waiters) resolve(covers.get(orderId) ?? null);
    }
  }

  @ResolveField('image_url', () => String, {
    nullable: true,
    description: 'Обложка товара по заказу позиции — первое изображение предложения; пусто, если изображений нет.',
  })
  imageUrl(@Parent() item: MarketplaceInventoryItemDTO): Promise<string | null> {
    // Остаток, зарезервированный под заказ из остатка, показывает товар
    // исходной партии: предложение у них одно и то же.
    return this.coverOf(item.order_id);
  }
}
