import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  platformSettings,
  GeneratedDocumentDTO,
  DocumentAggregateDTO,
  RequireRight,
  SELF,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceAcceptReturnAtVisitInputDTO,
  MarketplaceApproveReturnVisitInputDTO,
  MarketplaceCreateReturnClaimInputDTO,
  MarketplaceListReturnClaimsByBranameInputDTO,
  MarketplaceRejectReturnAtVisitInputDTO,
  MarketplaceRejectReturnRemoteInputDTO,
  MarketplaceReturnAcceptancePayloadDTO,
  MarketplaceReturnClaimDTO,
  MarketplaceReturnClaimResultDTO,
  MarketplaceReturnClaimSignablePayloadInputDTO,
  MarketplaceHandBackReturnInputDTO,
} from '../dto/marketplace-return-claim.dto';
import { MarketplaceReturnClaimService } from '../services/marketplace-return-claim.service';
import type { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import { toMarketplaceReturnClaimDTO } from './marketplace-return-claim.mapper';
import {
  MARKETPLACE_BRANCH_OWNERSHIP_SERVICE,
  MarketplaceBranchOwnershipService,
} from '../services/marketplace-branch-ownership.service';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';
import type { InnerGeneratedDocument } from '@coopenomics/innercoop';

function toGeneratedDocumentDTO(e: InnerGeneratedDocument): GeneratedDocumentDTO {
  const dto = new GeneratedDocumentDTO();
  dto.full_title = e.full_title;
  dto.html = e.html;
  dto.hash = e.hash;
  dto.meta = e.meta;
  dto.binary = e.binary;
  return dto;
}

/**
 * Эпик 7: GraphQL-фасад для процесса гарантийного возврата. Каждый из 5
 * mutation'ов соответствует одному C++ action'у контракта marketplace
 * (submretrn / aprretrem / rejretrem / accretrn / rejretrn).
 *
 * Access-matrix:
 *   - orderer: создаёт заявление, читает свои.
 *   - operator (председатель КУ): читает заявления своего КУ,
 *     принимает remote и on-site решения.
 */
@Resolver()
@Injectable()
export class MarketplaceReturnClaimResolver {
  constructor(
    private readonly service: MarketplaceReturnClaimService,
    @Inject(MARKETPLACE_BRANCH_OWNERSHIP_SERVICE)
    private readonly branchOwnership: MarketplaceBranchOwnershipService,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly orderDisplay: MarketplaceOrderDisplayService
  ) {}

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceReturnClaimSignablePayload',
    description:
      'Превью заявления на гарантийный возврат имущества для подписания пайщиком-заказчиком.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'create:own', { of: 'Order', id: 'data.order_id' })
  async marketplaceReturnClaimSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceReturnClaimSignablePayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const doc = await this.service.getReturnClaimSignablePayload({
      coopname: platformSettings().coopname,
      orderer_account: member.username,
      order_id: data.order_id,
      actual_quantity: data.actual_quantity,
      reason_text: data.reason_text,
    });
    return toGeneratedDocumentDTO(doc);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceCreateReturnClaim',
    description:
      'Пайщик подаёт заявление на гарантийный возврат имущества — backend кладёт фото в защищённое хранилище и фиксирует заявление в блокчейне.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'create:own', { of: 'Order', id: 'data.order_id' })
  async marketplaceCreateReturnClaim(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateReturnClaimInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.submitReturnClaim({
      coopname: platformSettings().coopname,
      orderer_account: member.username,
      order_id: data.order_id,
      reason_text: data.reason_text,
      defect_category: data.defect_category ?? null,
      actual_quantity: data.actual_quantity,
      signed_statement: data.signed_statement,
      photos: data.photos.map((p) => ({ base64: p.base64, mime_type: p.mime_type })),
    });
    return this.toResultDTO(result);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceApproveReturnVisit',
    description:
      'Председатель кооперативного участка по результатам удалённого рассмотрения приглашает пайщика на очный осмотр имущества.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'decide:remote', { ku: 'data.braname' })
  async marketplaceApproveReturnVisit(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceApproveReturnVisitInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.approveReturnVisit({
      coopname: platformSettings().coopname,
      chairman_account: member.username,
      braname: data.braname,
      claim_id: data.claim_id,
      comment: data.comment,
    });
    return this.toResultDTO(result);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceRejectReturnRemote',
    description:
      'Председатель отказывает в гарантийном возврате удалённо с указанием причины — финальное решение, движений по средствам нет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'decide:remote', { ku: 'data.braname' })
  async marketplaceRejectReturnRemote(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRejectReturnRemoteInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.rejectReturnRemote({
      coopname: platformSettings().coopname,
      chairman_account: member.username,
      braname: data.braname,
      claim_id: data.claim_id,
      comment: data.comment,
    });
    return this.toResultDTO(result);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceAcceptReturnAtVisit',
    description:
      'Оператор принял имущество у стойки: вторая подпись на заявлении о внесении паевого взноса имуществом, заявление уходит на повестку совета. ' +
      'Робот решений совета зовётся напрямую и ждётся у стойки; без решения заявление остаётся в спокойном ожидании — деньги двигаются только по решению совета.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'decide:on-site', { ku: 'data.braname' })
  async marketplaceAcceptReturnAtVisit(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAcceptReturnAtVisitInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.acceptReturnAtVisit({
      coopname: platformSettings().coopname,
      chairman_account: member.username,
      braname: data.braname,
      claim_id: data.claim_id,
      inspection_result: data.inspection_result,
      scanned_barcode: data.scanned_barcode ?? null,
      inspection_photos: data.inspection_photos?.map((p) => ({ base64: p.base64, mime_type: p.mime_type })),
      signed_statement: data.signed_statement,
      signed_reclamation: data.signed_reclamation,
    });
    return this.toResultDTO(result);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceRejectReturnAtVisit',
    description:
      'Оператор по результатам осмотра не принимает имущество — заказчик забирает его сразу, движений по средствам нет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'decide:on-site', { ku: 'data.braname' })
  async marketplaceRejectReturnAtVisit(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRejectReturnAtVisitInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.rejectReturnAtVisit({
      coopname: platformSettings().coopname,
      chairman_account: member.username,
      braname: data.braname,
      claim_id: data.claim_id,
      inspection_result: data.inspection_result,
      inspection_photos: data.inspection_photos?.map((p) => ({ base64: p.base64, mime_type: p.mime_type })),
    });
    return this.toResultDTO(result);
  }

  @Query(() => [MarketplaceReturnClaimDTO], {
    name: 'marketplaceListMyReturnClaims',
    description: 'Все заявления текущего пайщика на гарантийный возврат — активные и архивные.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'read:own', SELF)
  async marketplaceListMyReturnClaims(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceReturnClaimDTO[]> {
    const claims = await this.service.listByOrderer(platformSettings().coopname, member.username);
    return this.toClaimDTOs(claims);
  }

  @Query(() => [MarketplaceReturnClaimDTO], {
    name: 'marketplaceListReturnClaimsByBraname',
    description:
      'Список заявлений на гарантийный возврат, привязанных к кооперативному участку доставки — для председателя своего КУ.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'read:own-KU', { ku: 'data.delivery_braname' })
  async marketplaceListReturnClaimsByBraname(
    @Args('data') data: MarketplaceListReturnClaimsByBranameInputDTO
  ): Promise<MarketplaceReturnClaimDTO[]> {
    const claims = await this.service.listByDeliveryBraname(
      platformSettings().coopname,
      data.delivery_braname
    );
    return this.toClaimDTOs(claims);
  }

  @Query(() => MarketplaceReturnClaimDTO, {
    name: 'marketplaceReturnClaim',
    description: 'Получить одно заявление на гарантийный возврат по идентификатору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  // Заказчик читает своё заявление (read:own), председатель и доверенные
  // участка доставки — заявления своего участка (read:own-KU). Чьё это
  // заявление и чей участок, guard сверяет по самому заявлению.
  @RequireRight('ReturnClaim', ['read:own', 'read:own-KU'], { of: 'ReturnClaim', id: 'claim_id' })
  async marketplaceReturnClaim(
    @Args('claim_id') claim_id: string
  ): Promise<MarketplaceReturnClaimDTO> {
    const claim = await this.service.findById(platformSettings().coopname, claim_id);
    return this.toClaimDTO(claim);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceHandBackReturn',
    description:
      'Оператор выдал имущество обратно пайщику: после отказа совета либо по истечении срока ожидания решения (7 дней с приёма). Записи в цепи не остаётся, заказ остаётся выданным.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'hand-back', { ku: 'data.braname' })
  async marketplaceHandBackReturn(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceHandBackReturnInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.handBackReturn({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      braname: data.braname,
      claim_id: data.claim_id,
    });
    return this.toResultDTO(result);
  }

  @Query(() => MarketplaceReturnAcceptancePayloadDTO, {
    name: 'marketplaceReturnClaimChairmanSignablePayload',
    description:
      'Документы приёма имущества у стойки: заявление оператора участка в совет об отмене сделки (1116) — одна подпись оператора, и рекламация пайщика (1106) под вторую подпись оператора; с ней претензия уйдёт поставщику по решению совета.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('ReturnClaim', 'decide:on-site', { of: 'ReturnClaim', id: 'claim_id' })
  async marketplaceReturnClaimChairmanSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('claim_id') claim_id: string,
    @Args('inspection_result', { description: 'Результат осмотра имущества на участке — попадает в текст заявления.' })
    inspection_result: string
  ): Promise<MarketplaceReturnAcceptancePayloadDTO> {
    const docs = await this.service.getChairmanReturnSignablePayload({
      coopname: platformSettings().coopname,
      claim_id,
      operator_account: member.username,
      inspection_result,
    });
    return {
      cancel_statement: toGeneratedDocumentDTO(docs.cancel_statement),
      reclamation: new DocumentAggregateDTO(docs.reclamation),
    };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async toClaimDTO(
    claim: Awaited<ReturnType<MarketplaceReturnClaimService['findById']>>
  ): Promise<MarketplaceReturnClaimDTO> {
    // Имя заказчика — председатель КУ должен видеть «от кого», не сырой account.
    const display = await this.orderDisplay.enrichByOrderIds([claim.order_id], {
      withParticipantNames: true,
    });
    const { chairmanNames, branchNames } = await this.resolveDecisionLogNames([claim]);
    return toMarketplaceReturnClaimDTO(
      claim,
      (key) => this.service.getPhotoReadUrl(key),
      display.get(claim.order_id),
      chairmanNames,
      branchNames
    );
  }

  /** Батч-обогащение товаром/единицей/упаковкой/именем заказчика — один запрос заказов на весь список. */
  private async toClaimDTOs(
    claims: MarketplaceReturnClaimDomainEntity[]
  ): Promise<MarketplaceReturnClaimDTO[]> {
    const display = await this.orderDisplay.enrichByOrderIds(
      claims.map((c) => c.order_id),
      { withParticipantNames: true }
    );
    const { chairmanNames, branchNames } = await this.resolveDecisionLogNames(claims);
    return Promise.all(
      claims.map((c) =>
        toMarketplaceReturnClaimDTO(
          c,
          (key) => this.service.getPhotoReadUrl(key),
          display.get(c.order_id),
          chairmanNames,
          branchNames
        )
      )
    );
  }

  /**
   * История решений председателя показывает участника и КУ человеко-читаемо
   * (ФИО / название участка), не сырой account/braname — батч по всем записям
   * decision_log сразу для списка заявлений, одним запросом на каждый вид имени.
   */
  private async resolveDecisionLogNames(
    claims: MarketplaceReturnClaimDomainEntity[]
  ): Promise<{ chairmanNames: Map<string, string | null>; branchNames: Map<string, string | null> }> {
    const accounts = [...new Set(claims.flatMap((c) => c.decision_log.map((e) => e.by_chairman_account)))];
    const branames = [...new Set(claims.flatMap((c) => c.decision_log.map((e) => e.braname)))];
    const [chairmanNamesRaw, branchNames] = await Promise.all([
      this.orderDisplay.resolveAccountNames(accounts),
      this.orderDisplay.resolveBranchNames(branames),
    ]);
    return { chairmanNames: chairmanNamesRaw, branchNames };
  }

  private async toResultDTO(
    result: Awaited<ReturnType<MarketplaceReturnClaimService['submitReturnClaim']>>
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const dto = await this.toClaimDTO(result.claim);
    return { claim: dto, tx_hash: result.tx_hash };
  }
}
