import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser, createPaginationResult, PaginationInputDTO, PaginationResult, GeneratedDocumentDTO, GenerateDocumentOptionsInputDTO, TransactionDTO } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { KuService } from '../services/ku.service';
import { KuDecisionDTO, KuDecisionFilterInputDTO } from '../dto/ku-decision.dto';
import { KuTrustRequestDTO, KuTrustRequestFilterInputDTO } from '../dto/ku-trust-request.dto';
import {
  ApproveKuTrustedInputDTO,
  CancelKuDecisionInputDTO,
  CloseKuDecisionInputDTO,
  CreateKuDecisionInputDTO,
  DeclineKuTrustedInputDTO,
  ExecKuDecisionInputDTO,
  JoinKuDecisionInputDTO,
  RequestKuTrustedInputDTO,
  StartKuDecisionInputDTO,
  VoteOnKuDecisionInputDTO,
} from '../dto/ku-action-inputs.dto';
import {
  BranchEstablishmentPetitionGenerateDocumentInputDTO,
  BranchEstablishmentDecisionGenerateDocumentInputDTO,
  BranchTrustedLiabilityAgreementGenerateDocumentInputDTO,
  BranchTrusteeLiabilityAgreementGenerateDocumentInputDTO,
  BranchTrusteePowerOfAttorneyGenerateDocumentInputDTO,
  BranchTrustedPowerOfAttorneyGenerateDocumentInputDTO,
  BranchMeetingBallotGenerateDocumentInputDTO,
  BranchMeetingDecisionGenerateDocumentInputDTO,
  BranchMeetingProposalGenerateDocumentInputDTO,
  BranchTrustedStatementGenerateDocumentInputDTO,
} from '../dto/ku-documents.dto';

// Пагинированные результаты
const paginatedKuDecisionsResult = createPaginationResult(KuDecisionDTO, 'PaginatedKuDecisions');
const paginatedKuTrustRequestsResult = createPaginationResult(KuTrustRequestDTO, 'PaginatedKuTrustRequests');

/**
 * GraphQL-резолвер собраний и решений кооперативных участков (контракт branch)
 */
@Resolver()
export class KuResolver {
  constructor(private readonly kuService: KuService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Мутации собрания
  // ───────────────────────────────────────────────────────────────────────────

  @Mutation(() => TransactionDTO, {
    name: 'kuCreateDecision',
    description: 'Объявить собрание пайщиков кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuCreateDecision(
    @Args('data', { type: () => CreateKuDecisionInputDTO }) data: CreateKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.createDecision(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuJoinDecision',
    description: 'Присоединиться к собранию пайщиков кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuJoinDecision(
    @Args('data', { type: () => JoinKuDecisionInputDTO }) data: JoinKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.joinDecision(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuStartDecision',
    description: 'Открыть голосование на собрании пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuStartDecision(
    @Args('data', { type: () => StartKuDecisionInputDTO }) data: StartKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.startDecision(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuVoteOnDecision',
    description: 'Подать бюллетень на собрании пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuVoteOnDecision(
    @Args('data', { type: () => VoteOnKuDecisionInputDTO }) data: VoteOnKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.voteOnDecision(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuCloseDecision',
    description: 'Закрыть голосование и утвердить протокол собрания',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuCloseDecision(
    @Args('data', { type: () => CloseKuDecisionInputDTO }) data: CloseKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.closeDecision(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuExecDecision',
    description: 'Направить заявление председателя собрания в совет об учреждении участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuExecDecision(
    @Args('data', { type: () => ExecKuDecisionInputDTO }) data: ExecKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.execDecision(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuCancelDecision',
    description: 'Отменить собрание пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuCancelDecision(
    @Args('data', { type: () => CancelKuDecisionInputDTO }) data: CancelKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.cancelDecision(data, currentUser);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Мутации доверенных лиц
  // ───────────────────────────────────────────────────────────────────────────

  @Mutation(() => TransactionDTO, {
    name: 'kuRequestTrusted',
    description: 'Подать заявку на приём доверенным лицом кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuRequestTrusted(
    @Args('data', { type: () => RequestKuTrustedInputDTO }) data: RequestKuTrustedInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.requestTrusted(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuApproveTrusted',
    description: 'Одобрить заявку доверенного встречной подписью председателя участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuApproveTrusted(
    @Args('data', { type: () => ApproveKuTrustedInputDTO }) data: ApproveKuTrustedInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.approveTrusted(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuDeclineTrusted',
    description: 'Отклонить заявку доверенного лица',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuDeclineTrusted(
    @Args('data', { type: () => DeclineKuTrustedInputDTO }) data: DeclineKuTrustedInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.declineTrusted(data, currentUser);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Генерация документов
  // ───────────────────────────────────────────────────────────────────────────

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateMeetingProposal',
    description: 'Сгенерировать предложение повестки собрания пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateMeetingProposal(
    @Args('data', { type: () => BranchMeetingProposalGenerateDocumentInputDTO })
    data: BranchMeetingProposalGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchMeetingProposal(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateMeetingBallot',
    description: 'Сгенерировать бюллетень голосования на собрании участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateMeetingBallot(
    @Args('data', { type: () => BranchMeetingBallotGenerateDocumentInputDTO })
    data: BranchMeetingBallotGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchMeetingBallot(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateMeetingDecision',
    description: 'Сгенерировать протокол решения собрания пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateMeetingDecision(
    @Args('data', { type: () => BranchMeetingDecisionGenerateDocumentInputDTO })
    data: BranchMeetingDecisionGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchMeetingDecision(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateEstablishmentPetition',
    description: 'Сгенерировать заявление председателя собрания в совет об учреждении участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateEstablishmentPetition(
    @Args('data', { type: () => BranchEstablishmentPetitionGenerateDocumentInputDTO })
    data: BranchEstablishmentPetitionGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchEstablishmentPetition(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateEstablishmentDecision',
    description: 'Сгенерировать решение совета об учреждении кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async kuGenerateEstablishmentDecision(
    @Args('data', { type: () => BranchEstablishmentDecisionGenerateDocumentInputDTO })
    data: BranchEstablishmentDecisionGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchEstablishmentDecision(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateTrustedStatement',
    description: 'Сгенерировать заявление о приёме доверенным лицом участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateTrustedStatement(
    @Args('data', { type: () => BranchTrustedStatementGenerateDocumentInputDTO })
    data: BranchTrustedStatementGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchTrustedStatement(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateTrustedLiabilityAgreement',
    description: 'Сгенерировать договор о полной индивидуальной материальной ответственности доверенного лица кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateTrustedLiabilityAgreement(
    @Args('data', { type: () => BranchTrustedLiabilityAgreementGenerateDocumentInputDTO })
    data: BranchTrustedLiabilityAgreementGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchTrustedLiabilityAgreement(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateTrusteeLiabilityAgreement',
    description: 'Сгенерировать договор о полной индивидуальной материальной ответственности председателя кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateTrusteeLiabilityAgreement(
    @Args('data', { type: () => BranchTrusteeLiabilityAgreementGenerateDocumentInputDTO })
    data: BranchTrusteeLiabilityAgreementGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchTrusteeLiabilityAgreement(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateTrusteePowerOfAttorney',
    description: 'Сгенерировать доверенность председателю кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateTrusteePowerOfAttorney(
    @Args('data', { type: () => BranchTrusteePowerOfAttorneyGenerateDocumentInputDTO })
    data: BranchTrusteePowerOfAttorneyGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchTrusteePowerOfAttorney(data, options)) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateTrustedPowerOfAttorney',
    description: 'Сгенерировать доверенность доверенному лицу кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuGenerateTrustedPowerOfAttorney(
    @Args('data', { type: () => BranchTrustedPowerOfAttorneyGenerateDocumentInputDTO })
    data: BranchTrustedPowerOfAttorneyGenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return (await this.kuService.generateBranchTrustedPowerOfAttorney(data, options)) as GeneratedDocumentDTO;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Запросы
  // ───────────────────────────────────────────────────────────────────────────

  @Query(() => paginatedKuDecisionsResult, {
    name: 'kuDecisions',
    description: 'Получить список решений собраний кооперативных участков',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuDecisions(
    @Args('filter', { nullable: true }) filter?: KuDecisionFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<KuDecisionDTO>> {
    return this.kuService.getDecisions(filter, options);
  }

  @Query(() => KuDecisionDTO, {
    name: 'kuDecision',
    description: 'Получить решение собрания участка по хэшу (с вопросами повестки)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuDecision(@Args('hash', { type: () => String }) hash: string): Promise<KuDecisionDTO> {
    return this.kuService.getDecision(hash);
  }

  @Query(() => paginatedKuTrustRequestsResult, {
    name: 'kuTrustRequests',
    description: 'Получить список заявок доверенных лиц кооперативных участков',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  async kuTrustRequests(
    @Args('filter', { nullable: true }) filter?: KuTrustRequestFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<KuTrustRequestDTO>> {
    return this.kuService.getTrustRequests(filter, options);
  }
}
