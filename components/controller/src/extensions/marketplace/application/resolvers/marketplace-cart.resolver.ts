import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard, platformSettings, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceCartDTO } from '../dto/marketplace-cart.dto';
import {
  MarketplaceAddToCartInputDTO,
  MarketplaceRemoveFromCartInputDTO,
  MarketplaceSetCartDeliveryPointInputDTO,
  MarketplaceUpdateCartItemInputDTO,
} from '../dto/marketplace-cart-input.dto';
import {
  MARKETPLACE_CART_SERVICE,
  MarketplaceCartService,
} from '../services/marketplace-cart.service';
import {
  MARKETPLACE_CHECKOUT_SERVICE,
  MarketplaceCheckoutService,
} from '../services/marketplace-checkout.service';
import {
  MarketplaceCheckoutCartInputDTO,
  MarketplaceCheckoutResultDTO,
  MarketplaceCheckoutSignableLineDTO,
} from '../dto/marketplace-checkout.dto';
/**
 * Эпик 16: корзина заказчика — точка оформления заказа. Все операции
 * приватны для текущего пайщика (orderer): корзина одна на пару
 * (coopname, orderer_account).
 */
@Resolver()
@Injectable()
export class MarketplaceCartResolver {
  constructor(
    @Inject(MARKETPLACE_CART_SERVICE)
    private readonly cartService: MarketplaceCartService,
    @Inject(MARKETPLACE_CHECKOUT_SERVICE)
    private readonly checkoutService: MarketplaceCheckoutService
  ) {}

  @Query(() => MarketplaceCartDTO, {
    name: 'marketplaceGetCart',
    description: 'Корзина текущего заказчика (создаётся пустой при первом обращении).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceGetCart(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceCartDTO> {
    return this.cartService.getCart({
      coopname: platformSettings().coopname,
      orderer_account: member.username,
    });
  }

  @Mutation(() => MarketplaceCartDTO, {
    name: 'marketplaceAddToCart',
    description: 'Добавить товар в корзину (с привязкой корзины к пункту выдачи).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceAddToCart(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceAddToCartInputDTO
  ): Promise<MarketplaceCartDTO> {
    return this.cartService.addToCart(
      { coopname: platformSettings().coopname, orderer_account: member.username },
      {
        offer_id: input.offer_id,
        quantity: input.quantity,
        package_id: input.package_id ?? null,
        delivery_braname: input.delivery_braname ?? null,
      }
    );
  }

  @Mutation(() => MarketplaceCartDTO, {
    name: 'marketplaceUpdateCartItem',
    description: 'Изменить количество позиции в корзине.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceUpdateCartItem(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceUpdateCartItemInputDTO
  ): Promise<MarketplaceCartDTO> {
    return this.cartService.updateItem(
      { coopname: platformSettings().coopname, orderer_account: member.username },
      { offer_id: input.offer_id, quantity: input.quantity, package_id: input.package_id ?? null }
    );
  }

  @Mutation(() => MarketplaceCartDTO, {
    name: 'marketplaceRemoveFromCart',
    description: 'Убрать позицию из корзины.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceRemoveFromCart(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceRemoveFromCartInputDTO
  ): Promise<MarketplaceCartDTO> {
    return this.cartService.removeItem(
      { coopname: platformSettings().coopname, orderer_account: member.username },
      input.offer_id,
      input.package_id ?? null
    );
  }

  @Mutation(() => MarketplaceCartDTO, {
    name: 'marketplaceClearCart',
    description: 'Очистить корзину (убрать все позиции).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceClearCart(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceCartDTO> {
    return this.cartService.clear({
      coopname: platformSettings().coopname,
      orderer_account: member.username,
    });
  }

  @Query(() => [MarketplaceCheckoutSignableLineDTO], {
    name: 'marketplaceCheckoutSignablePayloads',
    description:
      'Заявления о конвертации паевого взноса к подписи — по одному на каждую позицию корзины. ' +
      'Подписанные заявления возвращаются строками lines в marketplaceCheckoutCart.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceCheckoutSignablePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceCheckoutSignableLineDTO[]> {
    const lines = await this.checkoutService.getSignablePayloads({
      coopname: platformSettings().coopname,
      orderer_account: member.username,
    });
    return lines.map((l) => {
      const document = new GeneratedDocumentDTO();
      document.full_title = l.document.full_title;
      document.html = l.document.html;
      document.hash = l.document.hash;
      document.meta = l.document.meta;
      document.binary = l.document.binary;
      return new MarketplaceCheckoutSignableLineDTO({
        offer_id: l.offer_id,
        package_id: l.package_id,
        order_hash: l.order_hash,
        amount: l.amount,
        document,
      });
    });
  }

  @Mutation(() => MarketplaceCheckoutResultDTO, {
    name: 'marketplaceCheckoutCart',
    description:
      'Оформить заказ из корзины: предвалидация баланса, построчное создание заказов с общим ' +
      'идентификатором заказа и КУ; непрошедший остаток остаётся в корзине для повтора. ' +
      'Каждая позиция сопровождается подписанным заявлением о конвертации паевого взноса (lines).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceCheckoutCart(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceCheckoutCartInputDTO
  ): Promise<MarketplaceCheckoutResultDTO> {
    return this.checkoutService.execute(
      { coopname: platformSettings().coopname, orderer_account: member.username },
      { checkout_id: input?.checkout_id ?? null, lines: input?.lines ?? null }
    );
  }

  @Mutation(() => MarketplaceCartDTO, {
    name: 'marketplaceSetCartDeliveryPoint',
    description: 'Сменить пункт выдачи (КУ) корзины — каталог зависит от выбранного КУ.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Cart', 'manage:own')
  async marketplaceSetCartDeliveryPoint(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSetCartDeliveryPointInputDTO
  ): Promise<MarketplaceCartDTO> {
    return this.cartService.setDeliveryPoint(
      { coopname: platformSettings().coopname, orderer_account: member.username },
      input.delivery_braname
    );
  }
}
