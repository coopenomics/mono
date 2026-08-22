import { Injectable } from '@nestjs/common';
import { MarketplaceCartDomainEntity } from '../../domain/entities/marketplace-cart.entity';
import { MarketplaceCartEntity } from '../entities/marketplace-cart.entity';
import { MarketplaceCartItemEntity } from '../entities/marketplace-cart-item.entity';

/**
 * Эпик 16: row → domain для корзины. Позиции собираются отдельной выборкой
 * (cart header + items) и склеиваются в доменный агрегат.
 */
@Injectable()
export class MarketplaceCartMapper {
  toDomain(
    cart: MarketplaceCartEntity,
    items: MarketplaceCartItemEntity[]
  ): MarketplaceCartDomainEntity {
    return new MarketplaceCartDomainEntity({
      id: cart.id,
      coopname: cart.coopname,
      orderer_account: cart.orderer_account,
      delivery_braname: cart.delivery_braname ?? null,
      items: items.map((i) => ({
        id: i.id,
        cart_id: i.cart_id,
        coopname: i.coopname,
        offer_id: i.offer_id,
        package_id: i.package_id ?? '',
        quantity: i.quantity,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    });
  }
}
