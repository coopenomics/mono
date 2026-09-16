import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DocumentAggregateDTO, GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceAdmitSupplierClaimInputDTO,
  MarketplaceSupplierClaimBranchContactsDTO,
  MarketplaceSupplierClaimDTO,
  MarketplaceSupplierClaimResultDTO,
  MarketplaceSupplierClaimStatusEnum,
  MarketplaceSupplierClaimSummaryDTO,
} from '../dto/marketplace-supplier-claim.dto';
import { MarketplaceSupplierClaimService } from '../services/marketplace-supplier-claim.service';
import type { MarketplaceSupplierClaimDomainEntity } from '../../domain/entities/marketplace-supplier-claim.entity';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';
import { toDecisionEntryDTO, toPhotoDTO } from './marketplace-return-claim.mapper';

type BranchContacts = Awaited<ReturnType<MarketplaceOrderDisplayService['resolveBranchContacts']>>;
type OrderDisplay = Awaited<ReturnType<MarketplaceOrderDisplayService['enrichByOrderIds']>> extends Map<string, infer V> ? V : never;

/**
 * Стол поставщика «Гарантийные возвраты» (задача 99D-13): список претензий и
 * сводка по двум кошелькам, карточка претензии с рекламацией в две подписи и
 * контактами участка, признание претензии. Несогласие в цепь не пишется —
 * поставщик связывается с участком. Поставщик видит только свои претензии
 * (`SupplierClaim:read:to-self`), совет и администратор — все.
 */
@Resolver()
@Injectable()
export class MarketplaceSupplierClaimResolver {
  constructor(
    private readonly service: MarketplaceSupplierClaimService,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly orderDisplay: MarketplaceOrderDisplayService
  ) {}

  @Query(() => [MarketplaceSupplierClaimDTO], {
    name: 'marketplaceListSupplierClaims',
    description: 'Гарантийные претензии, выставленные текущему поставщику, — новые сверху.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('SupplierClaim', 'read:to-self')
  async marketplaceListSupplierClaims(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceSupplierClaimDTO[]> {
    const list = await this.service.listBySupplier(platformSettings().coopname, member.username);
    return this.toDTOs(list, false);
  }

  @Query(() => MarketplaceSupplierClaimDTO, {
    name: 'marketplaceSupplierClaim',
    description: 'Одна гарантийная претензия с рекламацией, фотографиями и пройденными шагами возврата.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('SupplierClaim', ['read:to-self', 'read:all'])
  async marketplaceSupplierClaim(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('claim_id') claim_id: string
  ): Promise<MarketplaceSupplierClaimDTO> {
    const claim = await this.service.findById(platformSettings().coopname, claim_id);
    this.assertVisible(claim, member);
    const [dto] = await this.toDTOs([claim], true);
    return dto;
  }

  @Query(() => MarketplaceSupplierClaimSummaryDTO, {
    name: 'marketplaceSupplierClaimSummary',
    description: 'Сводка претензий текущего поставщика: признанный долг к удержанию из выплат и отказанные суммы.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('SupplierClaim', 'read:to-self')
  async marketplaceSupplierClaimSummary(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceSupplierClaimSummaryDTO> {
    return this.service.summary(platformSettings().coopname, member.username);
  }

  @Mutation(() => MarketplaceSupplierClaimResultDTO, {
    name: 'marketplaceAdmitSupplierClaim',
    description: 'Поставщик признаёт гарантийную претензию: сумма становится долгом и удерживается из следующих выплат.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('SupplierClaim', 'respond:to-self')
  async marketplaceAdmitSupplierClaim(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAdmitSupplierClaimInputDTO
  ): Promise<MarketplaceSupplierClaimResultDTO> {
    const result = await this.service.admit({
      coopname: platformSettings().coopname,
      supplier: member.username,
      claim_id: data.claim_id,
    });
    const [dto] = await this.toDTOs([result.claim], true);
    return { claim: dto, tx_hash: result.tx_hash };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private assertVisible(claim: MarketplaceSupplierClaimDomainEntity, member: IMarketplaceCurrentMember): void {
    if (claim.supplier_account === member.username) return;
    const roles = member.marketplace_roles ?? [];
    if (roles.includes('admin') || roles.includes('board') || roles.includes('board_readonly')) return;
    throw new ForbiddenException('Претензия выставлена другому поставщику.');
  }

  /** Контакты участков, где лежит имущество по претензиям, — по одному запросу на участок. */
  private async contactsByBranch(claims: MarketplaceSupplierClaimDomainEntity[]): Promise<Map<string, BranchContacts>> {
    const out = new Map<string, BranchContacts>();
    for (const braname of new Set(claims.map((c) => c.delivery_braname))) {
      out.set(braname, await this.orderDisplay.resolveBranchContacts(braname));
    }
    return out;
  }

  /** Куда поставщику ехать разбираться: реквизиты участка и оператор, принявший имущество. */
  private static branchContacts(
    contacts: BranchContacts | undefined,
    operatorAccount: string | null,
    names: Map<string, string>
  ): MarketplaceSupplierClaimBranchContactsDTO {
    return {
      name: contacts?.name ?? null,
      address: contacts?.address ?? null,
      phone: contacts?.phone ?? null,
      email: contacts?.email ?? null,
      operator_account: operatorAccount,
      operator_name: operatorAccount ? (names.get(operatorAccount) ?? null) : null,
    };
  }

  /** Поля, которые претензия берёт из заказа: заказчик, товар, фасовка, имя участка. */
  private static orderFields(d: OrderDisplay | undefined, branchName: string | null | undefined) {
    return {
      orderer_name: d?.orderer_name ?? null,
      delivery_branch_name: branchName ?? null,
      product_name: d?.product_name ?? null,
      unit_of_measure: d?.unit_of_measure ?? null,
      package_size: d?.package_size ?? null,
    };
  }

  /** Батч-обогащение: товар и участок из заказа, имена в истории; рекламация — только в карточке. */
  private async toDTOs(claims: MarketplaceSupplierClaimDomainEntity[], withDocument: boolean): Promise<MarketplaceSupplierClaimDTO[]> {
    const display = await this.orderDisplay.enrichByOrderIds(claims.map((c) => c.order_id), { withParticipantNames: true });
    const branchNames = await this.orderDisplay.resolveBranchNames([...new Set(claims.map((c) => c.delivery_braname))]);
    const contactsByBranch = await this.contactsByBranch(claims);
    return Promise.all(
      claims.map(async (claim) => {
        const photos = await Promise.all(claim.photos.map((p) => toPhotoDTO(p, (key) => this.service.getPhotoReadUrl(key))));
        const returnClaim = await this.service.historyOf(claim);
        const log = returnClaim?.decision_log ?? [];
        const names = await this.orderDisplay.resolveAccountNames([...new Set(log.map((e) => e.by_chairman_account))]);
        const logBranches = await this.orderDisplay.resolveBranchNames([...new Set(log.map((e) => e.braname))]);
        const aggregate = withDocument ? await this.service.reclamationAggregate(claim) : null;
        const operatorAccount = returnClaim?.on_site_inspection?.by_chairman_account ?? null;
        const branch_contacts = MarketplaceSupplierClaimResolver.branchContacts(
          contactsByBranch.get(claim.delivery_braname),
          operatorAccount,
          names
        );
        return {
          id: claim.id,
          coopname: claim.coopname,
          claim_hash: claim.claim_hash,
          return_claim_id: claim.return_claim_id,
          order_id: claim.order_id,
          order_hash: claim.order_hash,
          supplier_account: claim.supplier_account,
          orderer_account: claim.orderer_account,
          delivery_braname: claim.delivery_braname,
          ...MarketplaceSupplierClaimResolver.orderFields(display.get(claim.order_id), branchNames.get(claim.delivery_braname)),
          actual_quantity: claim.actual_quantity,
          amount: claim.amount,
          reason_text: claim.reason_text,
          inspection_result: claim.inspection_result,
          photos,
          reclamation: aggregate ? new DocumentAggregateDTO(aggregate) : null,
          status: claim.status as MarketplaceSupplierClaimStatusEnum,
          issued_at: claim.issued_at,
          decided_at: claim.decided_at,
          branch_contacts,
          history: log.map((e) => toDecisionEntryDTO(e, names, logBranches)),
          created_at: claim.created_at,
          updated_at: claim.updated_at,
        };
      })
    );
  }
}
