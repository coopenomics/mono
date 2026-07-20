import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import {
  MARKETPLACE_ECONOMY_SERVICE,
  MarketplaceEconomyService,
} from '../services/marketplace-economy.service';
import {
  MarketplaceAidDTO,
  MarketplaceBranchEconomyDTO,
  MarketplaceConvertBranchFundsInputDTO,
  MarketplaceCreateAidInputDTO,
  MarketplaceDeleteTrusteeWeightInputDTO,
  MarketplaceDistributeBranchFundsInputDTO,
  MarketplaceEconomyConfigDTO,
  MarketplaceListAidsInputDTO,
  MarketplacePersonalEconomyDTO,
  MarketplaceSetMembershipFeeInputDTO,
  MarketplaceSetTrusteeWeightInputDTO,
  MarketplaceAidStatementSignablePayloadInputDTO,
  toMarketplaceAidDTO,
  toMarketplaceBranchEconomyDTO,
} from '../dto/marketplace-economy.dto';

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
 * requirement b6 «Экономика КУ» (раунд 5 — приоритет общего кошелька):
 * единая ставка членского взноса, веса и ручное распределение из общего
 * кошелька, плановые расходы с 30-дневным резервом, персональные кошельки
 * доверенных (перевод в «Стол заказов» и материальная помощь).
 */
@Resolver()
@Injectable()
export class MarketplaceEconomyResolver {
  constructor(
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  // ── Единая ставка членского взноса ───────────────────────────────────

  @Query(() => MarketplaceEconomyConfigDTO, {
    name: 'marketplaceGetEconomyConfig',
    description:
      'Единая ставка членского взноса кооператива: процент, который добавляется к стоимости каждого заказа и после исполнения заказа распределяется кооперативному участку выдачи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'read')
  async marketplaceGetEconomyConfig(): Promise<MarketplaceEconomyConfigDTO> {
    const membership_fee_percent = await this.economyService.getMembershipFeePercent(
      config.coopname
    );
    return { membership_fee_percent };
  }

  @Mutation(() => MarketplaceEconomyConfigDTO, {
    name: 'marketplaceSetMembershipFee',
    description:
      'Установить единую ставку членского взноса кооператива (одинакова для всех кооперативных участков). Доступно администратору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'set-fee')
  async marketplaceSetMembershipFee(
    @Args('data') data: MarketplaceSetMembershipFeeInputDTO
  ): Promise<MarketplaceEconomyConfigDTO> {
    const membership_fee_percent = await this.economyService.setMembershipFee(
      config.coopname,
      data.membership_fee_percent
    );
    return { membership_fee_percent };
  }

  // ── Экономика кооперативного участка ─────────────────────────────────

  @Query(() => MarketplaceBranchEconomyDTO, {
    name: 'marketplaceGetBranchEconomy',
    description:
      'Экономика кооперативного участка: общий кошелёк членских взносов, плановые расходы и резерв на 30 дней, веса участников распределения и балансы персональных кошельков.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'read:own-KU')
  async marketplaceGetBranchEconomy(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('braname') braname: string
  ): Promise<MarketplaceBranchEconomyDTO> {
    await this.assertBranchScope(member, braname);
    const view = await this.economyService.getBranchEconomy(config.coopname, braname);
    return toMarketplaceBranchEconomyDTO(view);
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceDistributeBranchFunds',
    description:
      'Распределить указанную сумму из общего кошелька участка между председателем и доверенными по их весам. Возможно частично и несколько раз; после распределения в общем кошельке должно остаться не меньше планового резерва расходов на 30 дней. Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'configure:own-KU')
  async marketplaceDistributeBranchFunds(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceDistributeBranchFundsInputDTO
  ): Promise<boolean> {
    await this.economyService.distributeBranchFunds(
      config.coopname,
      member.username,
      data.braname,
      data.amount
    );
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceSetTrusteeWeight',
    description:
      'Назначить или изменить вес участника в распределении членских взносов участка (доля участника = его вес, делённый на сумму весов). Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'configure:own-KU')
  async marketplaceSetTrusteeWeight(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSetTrusteeWeightInputDTO
  ): Promise<boolean> {
    await this.economyService.setTrusteeWeight(
      config.coopname,
      member.username,
      data.braname,
      data.username,
      data.weight
    );
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceDeleteTrusteeWeight',
    description:
      'Исключить участника из распределения членских взносов участка: доли оставшихся пересчитываются автоматически. Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'configure:own-KU')
  async marketplaceDeleteTrusteeWeight(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceDeleteTrusteeWeightInputDTO
  ): Promise<boolean> {
    await this.economyService.deleteTrusteeWeight(
      config.coopname,
      member.username,
      data.braname,
      data.username
    );
    return true;
  }

  // ── Персональные средства доверенного ────────────────────────────────

  @Query(() => MarketplacePersonalEconomyDTO, {
    name: 'marketplaceGetPersonalEconomy',
    description:
      'Персональные членские средства текущего пайщика, распределённые ему как доверенному кооперативного участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceGetPersonalEconomy(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplacePersonalEconomyDTO> {
    const personal_balance = await this.economyService.getPersonalBalance(
      config.coopname,
      member.username
    );
    return { personal_balance };
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceConvertBranchFunds',
    description:
      'Перевести персональные членские средства в членский кошелёк «Стола заказов» — для заказа имущества как обычный пайщик.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceConvertBranchFunds(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceConvertBranchFundsInputDTO
  ): Promise<boolean> {
    await this.economyService.convertBranchFunds(config.coopname, member.username, data.amount);
    return true;
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceAidStatementSignablePayload',
    description:
      'Сформировать Заявление на выплату материальной помощи для подписания получателем: идентификатор заявки фиксируется в документе и возвращается в его данных.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceAidStatementSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAidStatementSignablePayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const doc = await this.economyService.buildAidStatement(
      config.coopname,
      member.username,
      data.braname,
      data.amount
    );
    return toGeneratedDocumentDTO(doc);
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceCreateAid',
    description:
      'Подать заявку на материальную помощь с собственного персонального кошелька членских средств: подписанное заявление уходит кассиру, выплата подтверждается фактическим банковским переводом. Налог с дохода получатель оплачивает самостоятельно.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceCreateAid(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateAidInputDTO
  ): Promise<boolean> {
    await this.economyService.createAid(
      config.coopname,
      member.username,
      data.braname,
      data.amount,
      data.aid_hash,
      data.statement
    );
    return true;
  }

  @Query(() => [MarketplaceAidDTO], {
    name: 'marketplaceListAids',
    description:
      'Заявки на материальную помощь: свои — для доверенного; все заявки кооператива — для администратора.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceListAids(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListAidsInputDTO
  ): Promise<MarketplaceAidDTO[]> {
    const canReadAll = canAccess(member.marketplace_roles as MarketplaceRole[], 'Economy', 'read:all');
    const username = canReadAll ? data?.username : member.username;
    const aids = await this.economyService.listAids(config.coopname, username);
    return aids.map(toMarketplaceAidDTO);
  }

  // ── Внутреннее ────────────────────────────────────────────────────────

  /** Скоупинг own-KU: председатель/доверенный видит экономику только своих КУ; админ — любую. */
  private async assertBranchScope(
    member: IMarketplaceCurrentMember,
    braname: string
  ): Promise<void> {
    if (canAccess(member.marketplace_roles as MarketplaceRole[], 'Economy', 'read:all')) return;
    const isMember = await this.kuChairmanService.isMemberOfBranch(
      config.coopname,
      braname,
      member.username
    );
    if (!isMember) {
      throw new ForbiddenException('Экономика участка доступна его председателю и доверенным');
    }
  }
}
