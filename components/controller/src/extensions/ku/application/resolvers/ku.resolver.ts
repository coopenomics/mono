import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  GqlJwtAuthGuard,
  CurrentUser,
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
  GeneratedDocumentDTO,
  GenerateDocumentOptionsInputDTO,
  TransactionDTO,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { KuService } from '../services/ku.service';
import { KuPowersOfAttorneyService } from '../services/ku-powers-of-attorney.service';
import {
  KuPowerOfAttorneyDTO,
  KuPowerOfAttorneyFilterInputDTO,
  KuTrusteeDocumentsDTO,
  KuTrusteeDocumentsInputDTO,
} from '../dto/ku-power-of-attorney.dto';
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
  SignKuTrusteeAuthorityInputDTO,
  SignKuTrusteeLiabilityInputDTO,
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
const paginatedKuPowersOfAttorneyResult = createPaginationResult(KuPowerOfAttorneyDTO, 'PaginatedKuPowersOfAttorney');

/**
 * GraphQL-резолвер собраний и решений кооперативных участков (контракт branch)
 */
@Resolver()
export class KuResolver {
  constructor(
    private readonly kuService: KuService,
    private readonly powersOfAttorney: KuPowersOfAttorneyService
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Мутации собрания
  // ───────────────────────────────────────────────────────────────────────────

  @Mutation(() => TransactionDTO, {
    name: 'kuCreateDecision',
    description: 'Объявить собрание пайщиков кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'create')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'join')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'conduct')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'vote')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'conduct')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'conduct')
  async kuExecDecision(
    @Args('data', { type: () => ExecKuDecisionInputDTO }) data: ExecKuDecisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.execDecision(data, currentUser);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Документы председателя участка (после решения совета об учреждении)
  // ───────────────────────────────────────────────────────────────────────────

  @Mutation(() => TransactionDTO, {
    name: 'kuSignTrusteeAuthority',
    description: 'Подписать доверенность председателя кооперативного участка — на встречную подпись председателю совета',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuAuthority', 'sign')
  async kuSignTrusteeAuthority(
    @Args('data', { type: () => SignKuTrusteeAuthorityInputDTO }) data: SignKuTrusteeAuthorityInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.signTrusteeAuthority(data, currentUser);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuSignTrusteeLiability',
    description: 'Подписать договор о полной материальной ответственности председателя участка — на встречную подпись председателю совета',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuAuthority', 'sign')
  async kuSignTrusteeLiability(
    @Args('data', { type: () => SignKuTrusteeLiabilityInputDTO }) data: SignKuTrusteeLiabilityInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.signTrusteeLiability(data, currentUser);
  }

  @Query(() => KuTrusteeDocumentsDTO, {
    name: 'kuTrusteeDocuments',
    description: 'Доверенность и договор председателя кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuAuthority', ['read:own', 'read:all'], { owner: 'data.username' })
  async kuTrusteeDocuments(
    @Args('data', { type: () => KuTrusteeDocumentsInputDTO }) data: KuTrusteeDocumentsInputDTO
  ): Promise<KuTrusteeDocumentsDTO> {
    return this.powersOfAttorney.trusteeDocuments(data.coopname, data.braname, data.username);
  }

  @Query(() => paginatedKuPowersOfAttorneyResult, {
    name: 'kuPowersOfAttorney',
    description: 'Реестр доверенностей кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuAuthority', ['read:own', 'read:all'], { owner: 'filter.holder' })
  async kuPowersOfAttorney(
    @Args('filter', { type: () => KuPowerOfAttorneyFilterInputDTO }) filter: KuPowerOfAttorneyFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<KuPowerOfAttorneyDTO>> {
    return this.powersOfAttorney.listDTO(filter, options);
  }

  @Mutation(() => TransactionDTO, {
    name: 'kuCancelDecision',
    description: 'Отменить собрание пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'cancel')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuTrust', 'request')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuTrust', 'decide')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuTrust', 'decide')
  async kuDeclineTrusted(
    @Args('data', { type: () => DeclineKuTrustedInputDTO }) data: DeclineKuTrustedInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return this.kuService.declineTrusted(data, currentUser);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Генерация документов
  //
  // Документы печатают паспортные данные того, чьё имя стоит в `username`,
  // поэтому пайщик генерирует их только за себя (самообход `RolesGuard`),
  // а за другого — совет. Роль `user` в списке открыла бы чужой паспорт
  // любому вошедшему.
  // ───────────────────────────────────────────────────────────────────────────

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'kuGenerateMeetingProposal',
    description: 'Сгенерировать предложение повестки собрания пайщиков участка',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDocument', ['generate:own', 'generate:all'], { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'read')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuDecision', 'read')
  async kuDecision(@Args('hash', { type: () => String }) hash: string): Promise<KuDecisionDTO> {
    return this.kuService.getDecision(hash);
  }

  @Query(() => paginatedKuTrustRequestsResult, {
    name: 'kuTrustRequests',
    description: 'Получить список заявок доверенных лиц кооперативных участков',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('KuTrust', 'read')
  async kuTrustRequests(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('filter', { nullable: true }) filter?: KuTrustRequestFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<KuTrustRequestDTO>> {
    return this.kuService.getTrustRequests(filter, options, currentUser);
  }
}
