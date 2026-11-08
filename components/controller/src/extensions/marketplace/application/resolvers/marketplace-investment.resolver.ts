import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GeneratedDocumentDTO,
  GqlJwtAuthGuard,
  PaginationInputDTO,
  RightsGuard,
  RequireRight,
  SELF,
  createPaginationResult,
  platformSettings,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { toGeneratedDocumentDTO } from '../shared/generated-document.util';
import { MarketplaceInvestmentService } from '../services/marketplace-investment.service';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from '../services/marketplace-economy.service';
import {
  MarketplaceBranchInvestmentDTO,
  MarketplaceClaimInvestmentInputDTO,
  MarketplaceCreateInvestPropertyInputDTO,
  MarketplaceDeclineInvestPropertyInputDTO,
  MarketplaceInvestAgreementDTO,
  MarketplaceInvestHistoryEntryDTO,
  MarketplaceInvestMoneyInputDTO,
  MarketplaceInvestPropertyRefInputDTO,
  MarketplaceInvestPropertyStatementInputDTO,
  MarketplaceInvestStatementInputDTO,
  MarketplaceInvestorDTO,
  MarketplaceSignInvestAgreementInputDTO,
  MarketplaceSignInvestPropertyInputDTO,
  toMarketplaceBranchInvestmentDTO,
  toMarketplaceInvestHistoryEntryDTO,
  toMarketplaceInvestorDTO,
} from '../dto/marketplace-investment.dto';

const paginatedInvestHistory = createPaginationResult(MarketplaceInvestHistoryEntryDTO, 'MarketplaceInvestHistory');

/**
 * Инвестиционный этап кооперативного участка (задача 99D-30): договор
 * участия, паевые взносы деньгами и имуществом, решение совета по имуществу и
 * возврат паевых взносов. Вносить могут операторы участка (председатель и
 * доверенные лица), одобряет и принимает имущество председатель участка.
 * Суммы к возврату считает контракт; запросы отдают предварительный расчёт.
 */
@Resolver()
@Injectable()
export class MarketplaceInvestmentResolver {
  constructor(
    private readonly investment: MarketplaceInvestmentService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService
  ) {}

  private readonly toAsset = (units: bigint): string => this.economyService.unitsToAsset(units);

  // ── Договор участия ────────────────────────────────────────────────────

  @Query(() => MarketplaceInvestAgreementDTO, {
    name: 'marketplaceMyInvestAgreement',
    nullable: true,
    description: 'Договор участия в хозяйственной деятельности текущего пайщика; пусто — договор не подписан.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceMyInvestAgreement(@CurrentMarketplaceMember() member: IMarketplaceCurrentMember): Promise<MarketplaceInvestAgreementDTO | null> {
    return this.investment.getAgreement(platformSettings().coopname, member.username);
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceInvestAgreementSignablePayload',
    description: 'Сформировать договор участия в хозяйственной деятельности по программе «Стол заказов» для подписи пайщиком.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceInvestAgreementSignablePayload(@CurrentMarketplaceMember() member: IMarketplaceCurrentMember): Promise<GeneratedDocumentDTO> {
    return toGeneratedDocumentDTO(await this.investment.generateAgreement(platformSettings().coopname, member.username));
  }

  @Mutation(() => MarketplaceInvestAgreementDTO, {
    name: 'marketplaceSignInvestAgreement',
    description: 'Подписать договор участия в хозяйственной деятельности. Договор один на пайщика в кооперативе.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceSignInvestAgreement(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSignInvestAgreementInputDTO
  ): Promise<MarketplaceInvestAgreementDTO | null> {
    const coopname = platformSettings().coopname;
    await this.investment.signAgreement(coopname, member.username, data.agreement);
    return this.investment.getAgreement(coopname, member.username);
  }

  // ── Паевой взнос деньгами ──────────────────────────────────────────────────

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceInvestStatementSignablePayload',
    description: 'Сформировать заявление о трансляции паевого взноса в договор участия по выбранному участку.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceInvestStatementSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceInvestStatementInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return toGeneratedDocumentDTO(await this.investment.generateInvestStatement(platformSettings().coopname, member.username, data.braname, data.amount));
  }

  @Mutation(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceInvestMoney',
    description: 'Внести деньги в кооперативный участок по подписанному заявлению: паевой взнос переходит на кошелёк договора участия.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceInvestMoney(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceInvestMoneyInputDTO
  ): Promise<MarketplaceBranchInvestmentDTO> {
    const coopname = platformSettings().coopname;
    await this.investment.investMoney(coopname, member.username, data.braname, data.invest_hash, data.amount, data.statement);
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(coopname, data.braname), this.toAsset);
  }

  // ── Паевой взнос имуществом ───────────────────────────────────────────────

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceInvestPropertyStatementSignablePayload',
    description: 'Сформировать заявление о паевом взносе имуществом в кооперативный участок.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceInvestPropertyStatementSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceInvestPropertyStatementInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return toGeneratedDocumentDTO(await this.investment.generatePropertyStatement(platformSettings().coopname, member.username, data.braname, data));
  }

  @Mutation(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceCreateInvestProperty',
    description: 'Подать заявление о паевом взносе имуществом в участок; заявление ждёт одобрения председателя участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceCreateInvestProperty(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateInvestPropertyInputDTO
  ): Promise<MarketplaceBranchInvestmentDTO> {
    const coopname = platformSettings().coopname;
    await this.investment.createProperty(coopname, member.username, data.braname, data.property_hash, data, data.statement);
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(coopname, data.braname), this.toAsset);
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceInvestPropertyApprovalSignablePayload',
    description: 'Заявление на имущество для подписи председателем участка — одобрение.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'configure:chaired-KU', { ku: 'data.braname' })
  async marketplaceInvestPropertyApprovalSignablePayload(@Args('data') data: MarketplaceInvestPropertyRefInputDTO): Promise<GeneratedDocumentDTO> {
    return toGeneratedDocumentDTO(await this.investment.generatePropertyApproval(platformSettings().coopname, data.property_hash));
  }

  @Mutation(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceApproveInvestProperty',
    description: 'Одобрить заявление на имущество; вопрос о приёме выносится на совет. Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'configure:chaired-KU', { ku: 'data.braname' })
  async marketplaceApproveInvestProperty(@Args('data') data: MarketplaceSignInvestPropertyInputDTO): Promise<MarketplaceBranchInvestmentDTO> {
    const coopname = platformSettings().coopname;
    await this.investment.approveProperty(coopname, data.braname, data.property_hash, data.document);
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(coopname, data.braname), this.toAsset);
  }

  @Mutation(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceDeclineInvestProperty',
    description: 'Отклонить заявление на имущество до передачи в совет. Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'configure:chaired-KU', { ku: 'data.braname' })
  async marketplaceDeclineInvestProperty(@Args('data') data: MarketplaceDeclineInvestPropertyInputDTO): Promise<MarketplaceBranchInvestmentDTO> {
    const coopname = platformSettings().coopname;
    await this.investment.declineProperty(coopname, data.braname, data.property_hash, data.reason);
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(coopname, data.braname), this.toAsset);
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceInvestPropertyActSignablePayload',
    description: 'Акт приёма-передачи имущества после решения совета: вносящий подписывает первым, председатель участка — вторым.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceInvestPropertyActSignablePayload(@Args('data') data: MarketplaceInvestPropertyRefInputDTO): Promise<GeneratedDocumentDTO> {
    return toGeneratedDocumentDTO(await this.investment.generatePropertyAct(platformSettings().coopname, data.property_hash));
  }

  @Mutation(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceSignInvestPropertyAct',
    description: 'Подписать акт приёма-передачи имущества первой подписью вносящего.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceSignInvestPropertyAct(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSignInvestPropertyInputDTO
  ): Promise<MarketplaceBranchInvestmentDTO> {
    const coopname = platformSettings().coopname;
    await this.investment.signPropertyAct(coopname, member.username, data.property_hash, data.document, false);
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(coopname, data.braname), this.toAsset);
  }

  @Mutation(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceAcceptInvestProperty',
    description: 'Подписать акт приёма-передачи второй подписью председателя участка — имущество принято. Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'configure:chaired-KU', { ku: 'data.braname' })
  async marketplaceAcceptInvestProperty(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSignInvestPropertyInputDTO
  ): Promise<MarketplaceBranchInvestmentDTO> {
    const coopname = platformSettings().coopname;
    await this.investment.signPropertyAct(coopname, member.username, data.property_hash, data.document, true);
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(coopname, data.braname), this.toAsset);
  }

  // ── Возврат и представления ───────────────────────────────────────────

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceInvestClaimSignablePayload',
    description: 'Сформировать заявление о трансляции доступного возврата с кошелька договора участия на главный паевой кошелёк.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceInvestClaimSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('braname') braname: string
  ): Promise<GeneratedDocumentDTO> {
    return toGeneratedDocumentDTO(await this.investment.generateClaimStatement(platformSettings().coopname, member.username, braname));
  }

  @Mutation(() => [MarketplaceInvestorDTO], {
    name: 'marketplaceClaimInvestment',
    description: 'Перевести доступный возврат паевого взноса на главный паевой кошелёк по подписанному заявлению. Сумму считает кооператив.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceClaimInvestment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceClaimInvestmentInputDTO
  ): Promise<MarketplaceInvestorDTO[]> {
    const coopname = platformSettings().coopname;
    await this.investment.claim(coopname, member.username, data.braname, data.claim_hash, data.statement);
    return (await this.investment.listMyInvestments(coopname, member.username)).map((v) => toMarketplaceInvestorDTO(v, this.toAsset));
  }

  @Query(() => [MarketplaceInvestorDTO], {
    name: 'marketplaceMyInvestments',
    description: 'Паевые взносы текущего пайщика по участкам: внесено, использовано, возвращено и доступно к переводу.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceMyInvestments(@CurrentMarketplaceMember() member: IMarketplaceCurrentMember): Promise<MarketplaceInvestorDTO[]> {
    return (await this.investment.listMyInvestments(platformSettings().coopname, member.username)).map((v) => toMarketplaceInvestorDTO(v, this.toAsset));
  }

  @Query(() => paginatedInvestHistory, {
    name: 'marketplaceMyInvestHistory',
    description: 'История паевых взносов текущего пайщика: деньги, принятое имущество, возвраты на главный паевой кошелёк. Новые первыми.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'use:own', SELF)
  async marketplaceMyInvestHistory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceInvestHistoryEntryDTO>> {
    const result = await this.investment.listMyHistory(platformSettings().coopname, member.username, options);
    return { ...result, items: result.items.map((v) => toMarketplaceInvestHistoryEntryDTO(v, this.toAsset)) };
  }

  @Query(() => MarketplaceBranchInvestmentDTO, {
    name: 'marketplaceBranchInvestment',
    description: 'Паевые взносы инициаторов кооперативного участка, фаза возврата и заявления на имущество до приёма.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'braname' })
  async marketplaceBranchInvestment(@Args('braname') braname: string): Promise<MarketplaceBranchInvestmentDTO> {
    return toMarketplaceBranchInvestmentDTO(await this.investment.getBranchInvestment(platformSettings().coopname, braname), this.toAsset);
  }
}
