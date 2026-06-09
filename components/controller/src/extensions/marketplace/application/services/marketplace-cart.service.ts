import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MARKETPLACE_CART_REPOSITORY,
  type MarketplaceCartDomainRepository,
} from '../../domain/repositories/marketplace-cart.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceCartDomainEntity } from '../../domain/entities/marketplace-cart.entity';
import { MarketplaceCartDTO, MarketplaceCartItemDTO } from '../dto/marketplace-cart.dto';
import { MarketplaceOfferImagesService } from './marketplace-offer-images.service';

export const MARKETPLACE_CART_SERVICE = Symbol('MARKETPLACE_CART_SERVICE');

interface CartScope {
  coopname: string;
  orderer_account: string;
}

/**
 * Эпик 16: бизнес-логика корзины заказчика.
 *
 * Инвариант «один заказ — один КУ» начинается уже в корзине: корзина
 * привязана к одному `delivery_braname`; добавить позицию на другой КУ
 * нельзя, пока корзина непуста (нужно сменить КУ или очистить). Каталог
 * отфильтрован по КУ (Story 16.3), здесь — защитная проверка доступности
 * оффера на КУ корзины.
 */
@Injectable()
export class MarketplaceCartService {
  constructor(
    @Inject(MARKETPLACE_CART_REPOSITORY)
    private readonly cartRepo: MarketplaceCartDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    private readonly imagesService: MarketplaceOfferImagesService
  ) {}

  async getCart(scope: CartScope): Promise<MarketplaceCartDTO> {
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    return this.buildCartDTO(cart);
  }

  async addToCart(
    scope: CartScope,
    input: { offer_id: string; quantity: number; delivery_braname?: string | null }
  ): Promise<MarketplaceCartDTO> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Количество должно быть целым числом больше нуля.');
    }
    const offer = await this.requireActiveOffer(scope.coopname, input.offer_id);

    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);

    // Определяем КУ корзины: при непустой корзине КУ зафиксирован, добавлять
    // можно только в его контексте; при пустой — КУ задаётся первым добавлением.
    const targetKu = this.resolveTargetDeliveryBraname(cart, input.delivery_braname);
    if (targetKu && !this.offerDeliversTo(offer, targetKu)) {
      throw new BadRequestException(
        'Этот товар не возят на выбранный пункт выдачи. Смените КУ или выберите другой товар.'
      );
    }
    if (targetKu && targetKu !== cart.delivery_braname) {
      await this.cartRepo.setDeliveryBraname(cart.id, targetKu);
    }

    await this.cartRepo.upsertItem(cart.id, scope.coopname, offer.id, input.quantity);
    return this.getCart(scope);
  }

  async updateItem(
    scope: CartScope,
    input: { offer_id: string; quantity: number }
  ): Promise<MarketplaceCartDTO> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Количество должно быть целым числом больше нуля.');
    }
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    await this.cartRepo.setItemQuantity(cart.id, input.offer_id, input.quantity);
    return this.getCart(scope);
  }

  async removeItem(scope: CartScope, offer_id: string): Promise<MarketplaceCartDTO> {
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    await this.cartRepo.removeItem(cart.id, offer_id);
    return this.getCart(scope);
  }

  async clear(scope: CartScope): Promise<MarketplaceCartDTO> {
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    await this.cartRepo.clear(cart.id);
    return this.getCart(scope);
  }

  async setDeliveryPoint(scope: CartScope, delivery_braname: string): Promise<MarketplaceCartDTO> {
    if (!delivery_braname) {
      throw new BadRequestException('Не указан пункт выдачи.');
    }
    const cart = await this.cartRepo.getOrCreate(scope.coopname, scope.orderer_account);
    await this.cartRepo.setDeliveryBraname(cart.id, delivery_braname);
    return this.getCart(scope);
  }

  // ── private ──

  private async requireActiveOffer(
    coopname: string,
    offer_id: string
  ): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.offerRepo.findById(offer_id);
    if (!offer) {
      throw new NotFoundException('Предложение не найдено.');
    }
    if (offer.coopname !== coopname) {
      throw new ForbiddenException('Предложение принадлежит другому кооперативу.');
    }
    if (offer.status !== MarketplaceOfferStatuses.ACTIVE) {
      throw new BadRequestException(
        `Предложение не активно (статус «${offer.status}»). В корзину добавить нельзя.`
      );
    }
    return offer;
  }

  private resolveTargetDeliveryBraname(
    cart: MarketplaceCartDomainEntity,
    inputKu: string | null | undefined
  ): string | null {
    if (cart.delivery_braname) {
      // Корзина уже привязана к КУ: если инпут указывает другой — отказ.
      if (inputKu && inputKu !== cart.delivery_braname) {
        throw new BadRequestException(
          'Корзина привязана к другому пункту выдачи. Смените КУ или очистите корзину перед добавлением.'
        );
      }
      return cart.delivery_braname;
    }
    return inputKu ?? null;
  }

  private offerDeliversTo(offer: MarketplaceOfferDomainEntity, braname: string): boolean {
    return offer.delivery_points.some((dp) => dp.braname === braname);
  }

  private async buildCartDTO(cart: MarketplaceCartDomainEntity): Promise<MarketplaceCartDTO> {
    const offerIds = cart.items.map((i) => i.offer_id);
    const offers = offerIds.length ? await this.offerRepo.findByIds(offerIds) : [];
    const offerById = new Map(offers.map((o) => [o.id, o]));

    let totalCost = 0;
    const items = await Promise.all(
      cart.items.map(async (item) => {
        const offer = offerById.get(item.offer_id) ?? null;
        const price = offer ? Number.parseFloat(offer.price_per_unit) : null;
        const lineTotalNum = price !== null ? price * item.quantity : null;
        const available = offer
          ? cart.delivery_braname
            ? this.offerDeliversTo(offer, cart.delivery_braname)
            : true
          : false;
        if (available && lineTotalNum !== null) {
          totalCost += lineTotalNum;
        }
        // Обложка товара — первое изображение оффера (как и в каталоге). URL
        // подписан и TTL-ограничен; строим тем же сервисом, что field-резолвер
        // images, чтобы в корзине было фото имущества, а не заглушка.
        const coverKey = offer?.images?.[0]?.bucket_key ?? null;
        const imageUrl = coverKey ? await this.imagesService.getReadUrl(coverKey) : null;
        return new MarketplaceCartItemDTO({
          id: item.id,
          offer_id: item.offer_id,
          quantity: item.quantity,
          product_name: offer?.product_name ?? null,
          unit_of_measure: offer?.unit_of_measure ?? null,
          price_per_unit: offer?.price_per_unit ?? null,
          line_total: lineTotalNum !== null ? lineTotalNum.toFixed(4) : null,
          image_url: imageUrl,
          available_on_current_ku: available,
          // Безлимитное предложение → null (клиент не ограничивает ввод); иначе —
          // остаток на предложении как потолок количества в корзине.
          max_available: offer && !offer.unlimited_flag ? offer.quantity_available : null,
        });
      })
    );

    return new MarketplaceCartDTO({
      id: cart.id,
      delivery_braname: cart.delivery_braname,
      delivery_point_name: null,
      items,
      positions_count: cart.positions_count,
      total_quantity: cart.total_quantity,
      total_cost: totalCost.toFixed(4),
    });
  }
}
