import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
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
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { MarketplaceOrderDTO, toMarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import type { MarketplaceStockProposalStatus } from '../../domain/entities/marketplace-stock-proposal.types';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

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
    const list = await this.stockService.listStock(config.coopname, branames);
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
      coopname: config.coopname,
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
      coopname: config.coopname,
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
      'Акты приёма-передачи к подписи оператором КУ для докладки со склада: по строке корзины — order_hash будущего заказа и документ для подписи передающей стороны.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'create:own-KU')
  async marketplaceStockIssuancePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceStockIssuancePrepareInputDTO
  ): Promise<MarketplaceStockIssuanceOperatorLineDTO[]> {
    await this.assertBranameAllowed(member, data.braname, 'StockProposal', 'create');
    const lines = await this.proposalService.getOperatorIssuancePayloads({
      coopname: config.coopname,
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
      dto.signiss1_document = new GeneratedDocumentDTO(l.signiss1_document);
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
      coopname: config.coopname,
      operator_account: member.username,
      braname: data.braname,
      member_account: data.member_account,
      items: (data.items ?? []).map((i) => ({
        offer_id: i.offer_id,
        quantity: i.quantity,
        order_hash: i.order_hash,
        signiss1_act: i.signiss1_act as unknown as ISignedDocumentDomainInterface,
      })),
      order_items: (data.order_items ?? []).map((i) => ({
        order_id: i.order_id,
        actual_quantity: i.actual_quantity,
        actual_unit_price: i.actual_unit_price,
        signiss1_act: i.signiss1_act as unknown as ISignedDocumentDomainInterface,
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
      config.coopname,
      data.proposal_id,
      member.username
    );
    return toMarketplaceStockProposalDTO(proposal);
  }

  @Query(() => MarketplaceStockAcceptPayloadDTO, {
    name: 'marketplaceStockProposalSignablePayloads',
    description:
      'Нагрузка к принятию предложения со склада: строки-заказы и ОДНО Заявление о конвертации ' +
      'на всю сумму доплаты. Если членских средств хватает (замена из высвобожденных) — заявления нет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'resolve:own')
  async marketplaceStockProposalSignablePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceResolveStockProposalInputDTO
  ): Promise<MarketplaceStockAcceptPayloadDTO> {
    const payload = await this.proposalService.getAcceptSignablePayloads(
      config.coopname,
      data.proposal_id,
      member.username
    );

    let convert_document: GeneratedDocumentDTO | null = null;
    if (payload.convert) {
      convert_document = new GeneratedDocumentDTO();
      convert_document.full_title = payload.convert.document.full_title;
      convert_document.html = payload.convert.document.html;
      convert_document.hash = payload.convert.document.hash;
      convert_document.meta = payload.convert.document.meta;
      convert_document.binary = payload.convert.document.binary;
    }

    return {
      order_lines: payload.order_lines.map((l) => ({
        offer_id: l.offer_id,
        order_hash: l.order_hash,
        signiss1_aggregate: new DocumentAggregateDTO(l.signiss1_aggregate),
      })),
      member_amount: payload.member_amount,
      convert_amount: payload.convert?.amount ?? null,
      convert_hash: payload.convert?.convert_hash ?? null,
      convert_document,
    };
  }

  @Mutation(() => MarketplaceStockProposalAcceptResultDTO, {
    name: 'marketplaceFinalizeStockIssuance',
    description:
      'Пайщик одной подписью утверждает докладку как акт: при дефиците членских средств — конвертация с паевого по подписанному Заявлению, ' +
      'затем по каждой строке создаётся заказ из остатка и проводится выдача (подпись передачи оператора + подпись получения пайщика). ' +
      'Имущество выдаётся сразу. Заявление (signed_convert) не передаётся, когда членских средств хватает.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StockProposal', 'resolve:own')
  async marketplaceFinalizeStockIssuance(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceFinalizeStockIssuanceInputDTO
  ): Promise<MarketplaceStockProposalAcceptResultDTO> {
    const result = await this.proposalService.finalizeStockIssuance(
      config.coopname,
      data.proposal_id,
      member.username,
      { order_lines: data.order_lines, signed_convert: data.signed_convert ?? null }
    );
    const dto = new MarketplaceStockProposalAcceptResultDTO();
    dto.proposal = toMarketplaceStockProposalDTO(result.proposal);
    dto.order_ids = result.order_ids;
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
      config.coopname,
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
      config.coopname,
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
        coopname: config.coopname,
        braname: branames,
        status: statuses,
      });
      return list.map(toMarketplaceStockProposalDTO);
    }
    const list = await this.proposalService.listProposals({
      coopname: config.coopname,
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
      return requested ? [requested] : await this.kuChairmanService.listAllBranames(config.coopname);
    }
    const ownBranames = await this.kuChairmanService.listBranamesForMember(
      config.coopname,
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
      config.coopname,
      member.username
    );
    if (!ownBranames.includes(braname)) {
      throw new ForbiddenException(
        'Действие доступно только на участке, где вы являетесь председателем или доверенным лицом.'
      );
    }
  }
}
