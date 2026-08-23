import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceCartDomainEntity } from '../../domain/entities/marketplace-cart.entity';
import type { MarketplaceCartDomainRepository } from '../../domain/repositories/marketplace-cart.repository';
import { MarketplaceCartEntity } from '../entities/marketplace-cart.entity';
import { MarketplaceCartItemEntity } from '../entities/marketplace-cart-item.entity';
import { MarketplaceCartMapper } from '../mappers/marketplace-cart.mapper';

@Injectable()
export class MarketplaceCartRepositoryAdapter implements MarketplaceCartDomainRepository {
  constructor(
    @InjectRepository(MarketplaceCartEntity, 'marketplace')
    private readonly cartRepo: Repository<MarketplaceCartEntity>,
    @InjectRepository(MarketplaceCartItemEntity, 'marketplace')
    private readonly itemRepo: Repository<MarketplaceCartItemEntity>,
    private readonly mapper: MarketplaceCartMapper
  ) {}

  async getOrCreate(
    coopname: string,
    orderer_account: string
  ): Promise<MarketplaceCartDomainEntity> {
    let cart = await this.cartRepo.findOne({ where: { coopname, orderer_account } });
    if (!cart) {
      // Идемпотентно: при гонке двух первых обращений уникальный индекс
      // (coopname, orderer_account) отсечёт дубль — перечитываем.
      try {
        cart = await this.cartRepo.save(
          this.cartRepo.create({ coopname, orderer_account, delivery_braname: null })
        );
      } catch {
        cart = await this.cartRepo.findOneOrFail({ where: { coopname, orderer_account } });
      }
    }
    return this.loadAggregate(cart);
  }

  async findByOrderer(
    coopname: string,
    orderer_account: string
  ): Promise<MarketplaceCartDomainEntity | null> {
    const cart = await this.cartRepo.findOne({ where: { coopname, orderer_account } });
    return cart ? this.loadAggregate(cart) : null;
  }

  async upsertItem(
    cart_id: string,
    coopname: string,
    offer_id: string,
    package_id: string,
    quantity: number
  ): Promise<void> {
    const existing = await this.itemRepo.findOne({ where: { cart_id, offer_id, package_id } });
    if (existing) {
      await this.itemRepo.update({ id: existing.id }, { quantity: existing.quantity + quantity });
    } else {
      await this.itemRepo.save(
        this.itemRepo.create({ cart_id, coopname, offer_id, package_id, quantity })
      );
    }
    await this.touchCart(cart_id);
  }

  async setItemQuantity(cart_id: string, offer_id: string, package_id: string, quantity: number): Promise<void> {
    await this.itemRepo.update({ cart_id, offer_id, package_id }, { quantity });
    await this.touchCart(cart_id);
  }

  async removeItem(cart_id: string, offer_id: string, package_id: string): Promise<void> {
    await this.itemRepo.delete({ cart_id, offer_id, package_id });
    await this.touchCart(cart_id);
  }

  async clear(cart_id: string): Promise<void> {
    await this.itemRepo.delete({ cart_id });
    await this.touchCart(cart_id);
  }

  async removeItems(cart_id: string, offer_ids: string[]): Promise<void> {
    if (offer_ids.length === 0) return;
    await this.itemRepo.delete({ cart_id, offer_id: In(offer_ids) });
    await this.touchCart(cart_id);
  }

  async setDeliveryBraname(cart_id: string, delivery_braname: string | null): Promise<void> {
    await this.cartRepo.update({ id: cart_id }, { delivery_braname });
  }

  // ── private ──

  private async loadAggregate(cart: MarketplaceCartEntity): Promise<MarketplaceCartDomainEntity> {
    const items = await this.itemRepo.find({
      where: { cart_id: cart.id },
      order: { created_at: 'ASC' },
    });
    return this.mapper.toDomain(cart, items);
  }

  /** Обновить updated_at корзины при изменении состава (для индикатора/сортировки). */
  private async touchCart(cart_id: string): Promise<void> {
    await this.cartRepo.update({ id: cart_id }, { updated_at: new Date() });
  }
}
