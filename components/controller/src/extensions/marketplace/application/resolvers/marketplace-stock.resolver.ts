import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';
import {
  MarketplaceStockService,
  MARKETPLACE_STOCK_SERVICE,
} from '../services/marketplace-stock.service';
import {
  MarketplaceStockProposalService,
  MARKETPLACE_STOCK_PROPOSAL_SERVICE,
} from '../services/marketplace-stock-proposal.service';
import {
  MarketplaceInventoryItemDTO,
  toMarketplaceInventoryItemDTO,
} from '../dto/marketplace-inventory.dto';
import { MarketplaceOfferDTO, toMarketplaceOfferDTO } from '../dto/marketplace-offer.dto';
import {
  MarketplaceCancelStockOrderInputDTO,
  MarketplaceCreateStockProposalInputDTO,
  MarketplaceFinalizeStockIssuanceInputDTO,
  MarketplaceListStockProposalsInputDTO,
  MarketplacePublishStockInputDTO,
  MarketplaceResolveStockProposalInputDTO,
  MarketplaceStockAcceptPayloadDTO,
  MarketplaceStockIssuanceOperatorLineDTO,
  MarketplaceStockIssuancePrepareInputDTO,
  MarketplaceStockProposalAcceptResultDTO,
  MarketplaceStockProposalDTO,
  MarketplaceUnpublishStockInputDTO,
  MarketplaceUnpublishStockResultDTO,
  toMarketplaceStockProposalDTO,
} from '../dto/marketplace-stock.dto';
import { MarketplaceOrderDTO, toMarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import type { MarketplaceStockProposalStatus } from '../../domain/entities/marketplace-stock-proposal.types';
import { toMarketplaceIssuanceSagaDTO } from '../dto/marketplace-issuance-saga.dto';

/**
 * requirement 76 «Склад кооператива на КУ»: обезличенный остаток, его
 * публикация в каталог оффером кооператива и двухфазная докладка у стойки.
 */
@Resolver()
@Injectable()
export class MarketplaceStockResolver {
  constructor(
    @Inject(MARKETPLACE_STOCK_SERVICE)
    private readonly stockService: MarketplaceStockService,
    @Inject(MARKETPLACE_STOCK_PROPOSAL_SERVICE)
    private readonly proposalService: MarketplaceStockProposalService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly orderDisplay: MarketplaceOrderDisplayService
  ) {}

  // ── Остаток и публикация ─────────────────────────────────────────────

  @Query(() => [MarketplaceInventoryItemDTO], {
    name: 'marketplaceListStock',
    description:
      'Обезличенный остаток склада кооператива: позиции, оставшиеся после недовыдач и отказов, доступные к публикации в каталог.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Stock', 'read:own-KU')
  async marketplaceListStock(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('braname', { nullable: true }) braname?: string
  ): Promise<MarketplaceInventoryItemDTO[]> {
    const branames = await this.resolveBranames(member, braname, 'Stock');
    if (branames.length === 0) return [];
    const list = await this.stockService.listStock(platformSettings().coopname, branames);
    // Единица измерения + package_size (Эпик 18) — «витрина на месте»:
    // остаток показывается в той же упаковке, в которой партия принята на
    // склад (см. resolveStockPackageSize для уже опубликованных офферов
    // остатка — здесь тот же батч, но по СЫРЫМ позициям до публикации).
    const display = await this.orderDisplay.enrichByOrderIds(list.map((i) => i.order_id));
    return list.map((item) => {
      const dto = toMarketplaceInventoryItemDTO(item);
      const d = display.get(item.order_id);
      dto.unit_of_measure = d?.unit_of_measure ?? null;
      dto.package_size = d?.package_size ?? null;
      return dto;
    });
  }

  @Mutation(() => [MarketplaceOfferDTO], {
    name: 'marketplacePublishStock',
    description:
      'Оператор публикует позиции остатка склада в каталог предложением от кооператива — по цене прибытия или с уценкой.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Stock', 'publish:own-KU')
  async marketplacePublishStock(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplacePublishStockInputDTO
  ): Promise<MarketplaceOfferDTO[]> {
    const offers = await this.stockService.publishStock({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_ids: data.inventory_ids,
      price_per_unit: data.price_per_unit ?? null,
      warranty_days: data.warranty_days ?? null,
    });
    return offers.map(toMarketplaceOfferDTO);
  }

  @Mutation(() => MarketplaceUnpublishStockResultDTO, {
    name: 'marketplaceUnpublishStock',
    description: 'Оператор снимает свободные позиции остатка с витрины каталога.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Stock', 'publish:own-KU')
  async marketplaceUnpublishStock(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceUnpublishStockInputDTO
  ): Promise<MarketplaceUnpublishStockResultDTO> {
    const affected = await this.stockService.unpublishStock({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_ids: data.inventory_ids,
    });
    const dto = new MarketplaceUnpublishStockResultDTO();
    dto.affected = affected;
    return dto;
  }

  // ── Докладка у стойки (двухфазная) ───────────────────────────────────

  @Query(() => [MarketplaceStockIssuanceOperatorLineDTO], {
    name: 'marketplaceStockIssuancePayloads',
    description:
      'Подготовка докладки со склада: по строке корзины — детерминированный order_hash будущего заказа и снапшоты цены/упаковки. Оператор ничего не подписывает: его подпись закрывающая.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'create:own-KU')
  async marketplaceStockIssuancePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceStockIssuancePrepareInputDTO
  ): Promise<MarketplaceStockIssuanceOperatorLineDTO[]> {
    await this.assertBranameAllowed(member, data.braname, 'StockProposal', 'create');
    const lines = await this.proposalService.getOperatorIssuancePayloads({
      coopname: platformSettings().coopname,
      braname: data.braname,
      member_account: data.member_account,
      operator_account: member.username,
      items: data.items,
    });
    return lines.map((l) => {
      const dto = new MarketplaceStockIssuanceOperatorLineDTO();
      dto.offer_id = l.offer_id;
      dto.quantity = l.quantity;
      dto.order_hash = l.order_hash;
      dto.unit_price = l.unit_price;
      dto.product_name = l.product_name;
      dto.package_id = l.package_id;
      dto.package_size = l.package_size;
      return dto;
    });
  }

  @Mutation(() => MarketplaceStockProposalDTO, {
    name: 'marketplaceCreateStockProposal',
    description:
      'Оператор у стойки формирует бандл выдачи пайщику (существующие заказы и/или докладка со склада), с уже подписанными им актами передачи — пайщику немедленно приходит акт на подпись получения. До его подписи ничего в блокчейне не происходит.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'create:own-KU')
  async marketplaceCreateStockProposal(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateStockProposalInputDTO
  ): Promise<MarketplaceStockProposalDTO> {
    await this.assertBranameAllowed(member, data.braname, 'StockProposal', 'create');
    const proposal = await this.proposalService.createProposal({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      braname: data.braname,
      member_account: data.member_account,
      items: (data.items ?? []).map((i) => ({
        offer_id: i.offer_id,
        quantity: i.quantity,
        package_id: i.package_id ?? null,
        order_hash: i.order_hash,
      })),
      order_items: (data.order_items ?? []).map((i) => ({
        order_id: i.order_id,
        actual_quantity: i.actual_quantity,
        actual_unit_price: i.actual_unit_price,
      })),
    });
    return toMarketplaceStockProposalDTO(proposal);
  }

  @Mutation(() => MarketplaceStockProposalDTO, {
    name: 'marketplaceCancelStockProposal',
    description: 'Оператор отзывает неотвеченное предложение (например, чтобы переформировать его).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'cancel:own-KU')
  async marketplaceCancelStockProposal(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceResolveStockProposalInputDTO
  ): Promise<MarketplaceStockProposalDTO> {
    const proposal = await this.proposalService.cancelProposal(
      platformSettings().coopname,
      data.proposal_id,
      member.username
    );
    return toMarketplaceStockProposalDTO(proposal);
  }

  @Query(() => MarketplaceStockAcceptPayloadDTO, {
    name: 'marketplaceStockProposalSignablePayloads',
    description:
      'Нагрузка к подписи бандла пайщиком: по каждой строке — заявление о возврате паевого взноса имуществом. ' +
      'Отдельного заявления о конвертации нет: паевой резерв под докладку берётся из свободного паевого при подписи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'resolve:own')
  async marketplaceStockProposalSignablePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceResolveStockProposalInputDTO
  ): Promise<MarketplaceStockAcceptPayloadDTO> {
    const payload = await this.proposalService.getAcceptSignablePayloads(
      platformSettings().coopname,
      data.proposal_id,
      member.username
    );
    return {
      order_lines: payload.order_lines.map((l) => ({
        offer_id: l.offer_id,
        order_id: l.order_id,
        order_hash: l.order_hash,
        statement: new GeneratedDocumentDTO(l.statement),
      })),
    };
  }

  @Mutation(() => MarketplaceStockProposalAcceptResultDTO, {
    name: 'marketplaceFinalizeStockIssuance',
    description:
      'Пайщик одним нажатием подписывает заявления по всем строкам бандла: по докладке создаётся заказ из остатка (резерв из паевого), ' +
      'по каждому заказу заявление уходит в цепь и на повестку совета; робот решений совета зовётся напрямую и ждётся у стойки. ' +
      'Ответ несёт саги выдачи: решение принято — пайщик подписывает акт, иначе — режим ожидания без действий с его стороны.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'resolve:own')
  async marketplaceFinalizeStockIssuance(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceFinalizeStockIssuanceInputDTO
  ): Promise<MarketplaceStockProposalAcceptResultDTO> {
    const result = await this.proposalService.finalizeStockIssuance(
      platformSettings().coopname,
      data.proposal_id,
      member.username,
      { order_lines: data.order_lines }
    );
    const dto = new MarketplaceStockProposalAcceptResultDTO();
    dto.proposal = toMarketplaceStockProposalDTO(result.proposal);
    dto.order_ids = result.order_ids;
    dto.sagas = result.sagas.map(toMarketplaceIssuanceSagaDTO);
    return dto;
  }

  @Mutation(() => MarketplaceStockProposalDTO, {
    name: 'marketplaceDeclineStockProposal',
    description: 'Пайщик отказывается от предложения со склада кооператива.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'resolve:own')
  async marketplaceDeclineStockProposal(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceResolveStockProposalInputDTO
  ): Promise<MarketplaceStockProposalDTO> {
    const proposal = await this.proposalService.declineProposal(
      platformSettings().coopname,
      data.proposal_id,
      member.username
    );
    return toMarketplaceStockProposalDTO(proposal);
  }

  @Mutation(() => MarketplaceOrderDTO, {
    name: 'marketplaceCancelStockOrder',
    description:
      'Оператор отменяет заказ со склада кооператива до открытия выдачи (например, при переформировании докладки). Средства возвращаются пайщику, позиции — в остаток.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'cancel:own-KU')
  async marketplaceCancelStockOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCancelStockOrderInputDTO
  ): Promise<MarketplaceOrderDTO> {
    const order = await this.stockService.cancelStockOrder(
      platformSettings().coopname,
      data.order_id,
      member.username,
      data.reason ?? 'Докладка переформирована оператором'
    );
    return toMarketplaceOrderDTO(order);
  }

  @Query(() => [MarketplaceStockProposalDTO], {
    name: 'marketplaceListStockProposals',
    description:
      'Предложения со склада кооператива: входящие пайщика либо активные предложения стойки оператора.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'read:own')
  async marketplaceListStockProposals(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListStockProposalsInputDTO
  ): Promise<MarketplaceStockProposalDTO[]> {
    const roles = member.marketplace_roles as MarketplaceRole[];
    const statuses = data?.statuses?.length
      ? (data.statuses as unknown as MarketplaceStockProposalStatus[])
      : undefined;

    // Оператор/админ видят предложения своих КУ (стойка); пайщик — только свои.
    if (canAccess(roles, 'StockProposal', 'read:own-KU')) {
      const branames = await this.resolveBranames(member, data?.braname, 'StockProposal');
      if (branames.length === 0) return [];
      const list = await this.proposalService.listProposals({
        coopname: platformSettings().coopname,
        braname: branames,
        status: statuses,
      });
      return list.map(toMarketplaceStockProposalDTO);
    }
    const list = await this.proposalService.listProposals({
      coopname: platformSettings().coopname,
      member_account: member.username,
      status: statuses,
    });
    return list.map(toMarketplaceStockProposalDTO);
  }

  // ── private ──────────────────────────────────────────────────────────

  /**
   * Ownership-скоупинг по КУ (ответственность резолвера, не матрицы): роль с
   * `<resource>:*:all` видит весь кооператив, остальные — только участки, где
   * они председатель/доверенное лицо.
   */
  private async resolveBranames(
    member: IMarketplaceCurrentMember,
    requested: string | undefined,
    resource: 'Stock' | 'StockProposal'
  ): Promise<string[]> {
    const roles = member.marketplace_roles as MarketplaceRole[];
    if (canAccess(roles, resource, 'read:all')) {
      return requested ? [requested] : await this.kuChairmanService.listAllBranames(platformSettings().coopname);
    }
    const ownBranames = await this.kuChairmanService.listBranamesForMember(
      platformSettings().coopname,
      member.username
    );
    if (requested) {
      if (!ownBranames.includes(requested)) {
        throw new ForbiddenException(
          'Остаток доступен только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
      return [requested];
    }
    return ownBranames;
  }

  private async assertBranameAllowed(
    member: IMarketplaceCurrentMember,
    braname: string,
    resource: 'Stock' | 'StockProposal',
    action: string
  ): Promise<void> {
    const roles = member.marketplace_roles as MarketplaceRole[];
    if (canAccess(roles, resource, `${action}:all`)) return;
    const ownBranames = await this.kuChairmanService.listBranamesForMember(
      platformSettings().coopname,
      member.username
    );
    if (!ownBranames.includes(braname)) {
      throw new ForbiddenException(
        'Действие доступно только на участке, где вы являетесь председателем или доверенным лицом.'
      );
    }
  }
}
