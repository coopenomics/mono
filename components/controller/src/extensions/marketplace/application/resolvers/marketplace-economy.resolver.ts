import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeneratedDocumentDTO, GqlJwtAuthGuard, createPaginationResult, PaginationInputDTO, type PaginationResult, platformSettings } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import { CreateBranchExpenseInputDTO } from '../dto/branch-expense.dto';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { InnerGeneratedDocument } from '@coopenomics/innercoop';
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
  MarketplaceBranchWalletOperationDTO,
  MarketplaceRecallShareInputDTO,
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
  toMarketplaceBranchWalletOperationDTO,
} from '../dto/marketplace-economy.dto';

const paginatedBranchWalletHistoryResult = createPaginationResult(
  MarketplaceBranchWalletOperationDTO,
  'MarketplaceBranchWalletHistory'
);

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
      platformSettings().coopname
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
      platformSettings().coopname,
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
    const view = await this.economyService.getBranchEconomy(platformSettings().coopname, braname);
    return toMarketplaceBranchEconomyDTO(view);
  }

  @Query(() => paginatedBranchWalletHistoryResult, {
    name: 'marketplaceGetBranchWalletHistory',
    description:
      'Движения по общему кошельку кооперативного участка: поступления членских взносов с исполненных заказов, изъятия в распределение, оплата плановых расходов.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'read:own-KU')
  async marketplaceGetBranchWalletHistory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('braname') braname: string,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchWalletOperationDTO>> {
    await this.assertBranchScope(member, braname);
    const result = await this.economyService.getBranchWalletHistory(platformSettings().coopname, braname, options);
    return {
      ...result,
      items: result.items.map(toMarketplaceBranchWalletOperationDTO),
    };
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
      platformSettings().coopname,
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
      platformSettings().coopname,
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
      platformSettings().coopname,
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
      platformSettings().coopname,
      member.username
    );
    return { personal_balance };
  }

  @Query(() => paginatedBranchWalletHistoryResult, {
    name: 'marketplaceGetPersonalWalletHistory',
    description:
      'Движения по персональному кошельку членских средств текущего пайщика: переводы в Стол заказов и завершённая материальная помощь.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceGetPersonalWalletHistory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchWalletOperationDTO>> {
    const result = await this.economyService.getPersonalWalletHistory(
      platformSettings().coopname,
      member.username,
      options
    );
    return {
      ...result,
      items: result.items.map(toMarketplaceBranchWalletOperationDTO),
    };
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceRecallShare',
    description:
      'Вывести свободный паевой «Стола заказов» (остатки от отмен, недовыдач и возвратов) в общий паевой Цифрового кошелька. Документа не требуется.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceRecallShare(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRecallShareInputDTO
  ): Promise<boolean> {
    await this.economyService.recallShare(platformSettings().coopname, member.username, data.amount);
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
      platformSettings().coopname,
      member.username,
      data.braname,
      data.amount
    );
    return toGeneratedDocumentDTO(doc);
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceCreateAid',
    description:
      'Подать заявление на материальную помощь с собственного персонального кошелька членских средств: подписанное заявление выносится на рассмотрение совета, и только по его положительному решению заявка передаётся кассиру. Налог с дохода получатель оплачивает самостоятельно.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceCreateAid(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateAidInputDTO
  ): Promise<boolean> {
    await this.economyService.createAid(
      platformSettings().coopname,
      member.username,
      data.braname,
      data.amount,
      data.aid_hash,
      data.statement,
      data.payment_method_id
    );
    return true;
  }

  @Mutation(() => String, {
    name: 'marketplaceCreateBranchExpense',
    description:
      'Подать расход кооперативного участка: сумма расхода выделяется из общего кошелька участка, а сам расход выносится на решение совета. После одобрения кассир платит по реквизитам либо выдаёт аванс под отчёт; неизрасходованное возвращается участку. Возвращает идентификатор расхода.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceCreateBranchExpense(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: CreateBranchExpenseInputDTO
  ): Promise<string> {
    return this.economyService.createBranchExpense(platformSettings().coopname, member.username, data);
  }

  @Query(() => [MarketplaceAidDTO], {
    name: 'marketplaceListAids',
    description:
      'Заявления на материальную помощь: свои — для доверенного; все заявления кооператива — для администратора. Показывает стадию (рассмотрение советом либо ожидание выплаты) и статус выплаты у кассира.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Economy', 'use:own')
  async marketplaceListAids(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListAidsInputDTO
  ): Promise<MarketplaceAidDTO[]> {
    const canReadAll = canAccess(member.marketplace_roles as MarketplaceRole[], 'Economy', 'read:all');
    const username = canReadAll ? data?.username : member.username;
    const aids = await this.economyService.listAids(platformSettings().coopname, username);
    return aids.map(toMarketplaceAidDTO);
  }

  // ── Внутреннее ────────────────────────────────────────────────────────

  /** Скоупинг own-KU: председатель/доверенный видит экономику только своих КУ; админ — любую. */
  private async assertBranchScope(
    member: IMarketplaceCurrentMember,
    braname: string
  ): Promise<void> {
    if (canAccess(member.marketplace_roles as MarketplaceRole[], 'Economy', 'read:all')) return;
    await this.kuChairmanService.assertIsMemberOfBranch(
      platformSettings().coopname,
      braname,
      member.username,
      'Экономика участка доступна его председателю и доверенным'
    );
  }
}
