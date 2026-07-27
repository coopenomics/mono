import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import {
  MarketplaceAcceptReturnAtVisitInputDTO,
  MarketplaceApproveReturnVisitInputDTO,
  MarketplaceCreateReturnClaimInputDTO,
  MarketplaceListReturnClaimsByBranameInputDTO,
  MarketplaceRejectReturnAtVisitInputDTO,
  MarketplaceRejectReturnRemoteInputDTO,
  MarketplaceReturnClaimDTO,
  MarketplaceReturnClaimResultDTO,
  MarketplaceReturnClaimSignablePayloadInputDTO,
} from '../dto/marketplace-return-claim.dto';
import { MarketplaceReturnClaimService } from '../services/marketplace-return-claim.service';
import type { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import { toMarketplaceReturnClaimDTO } from './marketplace-return-claim.mapper';
import {
  MARKETPLACE_BRANCH_OWNERSHIP_SERVICE,
  MarketplaceBranchOwnershipService,
} from '../services/marketplace-branch-ownership.service';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';

function toGeneratedDocumentDTO(e: DocumentDomainEntity): GeneratedDocumentDTO {
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
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'create:own')
  async marketplaceReturnClaimSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceReturnClaimSignablePayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const doc = await this.service.getReturnClaimSignablePayload({
      coopname: config.coopname,
      orderer_account: member.username,
      order_id: data.order_id,
      actual_quantity: data.actual_quantity,
      reason_text: data.reason_text,
      defect_category: data.defect_category,
    });
    return toGeneratedDocumentDTO(doc);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceCreateReturnClaim',
    description:
      'Пайщик подаёт заявление на гарантийный возврат имущества — backend кладёт фото в защищённое хранилище и фиксирует заявление в блокчейне.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'create:own')
  async marketplaceCreateReturnClaim(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateReturnClaimInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.submitReturnClaim({
      coopname: config.coopname,
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'decide:remote')
  async marketplaceApproveReturnVisit(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceApproveReturnVisitInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.approveReturnVisit({
      coopname: config.coopname,
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'decide:remote')
  async marketplaceRejectReturnRemote(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRejectReturnRemoteInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.rejectReturnRemote({
      coopname: config.coopname,
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
      'Председатель по результатам очного осмотра принимает гарантийный возврат — атомарно восстанавливает средства на программный кошелёк пайщика и возвращает имущество на склад участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'decide:on-site')
  async marketplaceAcceptReturnAtVisit(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAcceptReturnAtVisitInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.acceptReturnAtVisit({
      coopname: config.coopname,
      chairman_account: member.username,
      braname: data.braname,
      claim_id: data.claim_id,
      inspection_result: data.inspection_result,
      scanned_barcode: data.scanned_barcode ?? null,
      inspection_photos: data.inspection_photos?.map((p) => ({ base64: p.base64, mime_type: p.mime_type })),
      signed_statement: data.signed_statement,
    });
    return this.toResultDTO(result);
  }

  @Mutation(() => MarketplaceReturnClaimResultDTO, {
    name: 'marketplaceRejectReturnAtVisit',
    description:
      'Председатель по результатам очного осмотра отказывает в гарантийном возврате — заказчик забирает имущество обратно, движений по средствам нет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'decide:on-site')
  async marketplaceRejectReturnAtVisit(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRejectReturnAtVisitInputDTO
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const result = await this.service.rejectReturnAtVisit({
      coopname: config.coopname,
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'read:own')
  async marketplaceListMyReturnClaims(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceReturnClaimDTO[]> {
    const claims = await this.service.listByOrderer(config.coopname, member.username);
    return this.toClaimDTOs(claims);
  }

  @Query(() => [MarketplaceReturnClaimDTO], {
    name: 'marketplaceListReturnClaimsByBraname',
    description:
      'Список заявлений на гарантийный возврат, привязанных к кооперативному участку доставки — для председателя своего КУ.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'read:own-KU')
  async marketplaceListReturnClaimsByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListReturnClaimsByBranameInputDTO
  ): Promise<MarketplaceReturnClaimDTO[]> {
    // Ownership `:own-KU` — пайщик должен быть trustee или trusted
    // именно того КУ, к которому привязано заявление. Проверка идёт
    // через единый источник истины состава КУ (MarketplaceKuChairmanService).
    const isMember = await this.kuChairmanService.isMemberOfBranch(
      config.coopname,
      data.delivery_braname,
      member.username
    );
    if (!isMember) {
      throw new ForbiddenException(
        'Чтение заявлений возможно только для участка, на котором вы являетесь председателем или доверенным лицом.'
      );
    }
    const claims = await this.service.listByDeliveryBraname(
      config.coopname,
      data.delivery_braname
    );
    return this.toClaimDTOs(claims);
  }

  @Query(() => MarketplaceReturnClaimDTO, {
    name: 'marketplaceReturnClaim',
    description: 'Получить одно заявление на гарантийный возврат по идентификатору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'read:own')
  async marketplaceReturnClaim(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('claim_id') claim_id: string
  ): Promise<MarketplaceReturnClaimDTO> {
    const claim = await this.service.findById(config.coopname, claim_id);
    // Ownership-проверка `:own` — matrix capability проверена guard'ом,
    // здесь верифицируем, что пайщик действительно владелец заявления:
    // либо заказчик Order'а, либо член КУ доставки (trustee/trusted —
    // в marketplace-домене они равны в правах).
    const isOwnerOrderer = claim.orderer_account === member.username;
    const isOperatorOfDeliveryKu =
      member.marketplace_roles.includes('operator') &&
      (await this.kuChairmanService.isMemberOfBranch(
        config.coopname,
        claim.delivery_braname,
        member.username
      ));
    if (!isOwnerOrderer && !isOperatorOfDeliveryKu) {
      throw new ForbiddenException('Это чужое заявление на возврат.');
    }
    return this.toClaimDTO(claim);
  }

  @Query(() => DocumentAggregateDTO, {
    name: 'marketplaceReturnClaimChairmanSignablePayload',
    description:
      'Заявление пайщика на гарантийный возврат, подписанное пайщиком, для со-подписи председателя при принятии на очном осмотре. Содержит тело документа для ознакомления и подпись пайщика; председатель накладывает свою подпись поверх.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('ReturnClaim', 'decide:on-site')
  async marketplaceReturnClaimChairmanSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('claim_id') claim_id: string
  ): Promise<DocumentAggregateDTO> {
    const claim = await this.service.findById(config.coopname, claim_id);
    const isMember = await this.kuChairmanService.isMemberOfBranch(
      config.coopname,
      claim.delivery_braname,
      member.username
    );
    if (!isMember) {
      throw new ForbiddenException(
        'Со-подпись возможна только для участка, на котором вы являетесь председателем или доверенным лицом.'
      );
    }
    const aggregate = await this.service.getChairmanReturnSignablePayload(
      config.coopname,
      claim_id
    );
    return new DocumentAggregateDTO(aggregate);
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async toClaimDTO(
    claim: Awaited<ReturnType<MarketplaceReturnClaimService['findById']>>
  ): Promise<MarketplaceReturnClaimDTO> {
    // Имя заказчика — председатель КУ должен видеть «от кого», не сырой account.
    const display = await this.orderDisplay.enrichByOrderIds([claim.order_id], {
      withParticipantNames: true,
    });
    return toMarketplaceReturnClaimDTO(
      claim,
      (key) => this.service.getPhotoReadUrl(key),
      display.get(claim.order_id)
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
    return Promise.all(
      claims.map((c) =>
        toMarketplaceReturnClaimDTO(
          c,
          (key) => this.service.getPhotoReadUrl(key),
          display.get(c.order_id)
        )
      )
    );
  }

  private async toResultDTO(
    result: Awaited<ReturnType<MarketplaceReturnClaimService['submitReturnClaim']>>
  ): Promise<MarketplaceReturnClaimResultDTO> {
    const dto = await this.toClaimDTO(result.claim);
    return { claim: dto, tx_hash: result.tx_hash };
  }
}
