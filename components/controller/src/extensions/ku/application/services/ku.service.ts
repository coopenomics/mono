import { Inject, Injectable } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import httpStatus from 'http-status';
import type { ISignedDocument, IMonoAccount } from '@coopenomics/innercoop';
import type { GenerateDocumentOptionsInputDTO, PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { KU_BLOCKCHAIN_PORT, type KuBlockchainPort } from '../../domain/interfaces/ku-blockchain.port';
import { KU_DECISION_REPOSITORY, type KuDecisionRepository } from '../../domain/repositories/ku-decision.repository';
import {
  KU_DECISION_QUESTION_REPOSITORY,
  type KuDecisionQuestionRepository,
} from '../../domain/repositories/ku-decision-question.repository';
import {
  KU_TRUST_REQUEST_REPOSITORY,
  type KuTrustRequestRepository,
} from '../../domain/repositories/ku-trust-request.repository';
import type { KuDecisionDomainEntity } from '../../domain/entities/ku-decision.entity';
import type { KuDecisionQuestionDomainEntity } from '../../domain/entities/ku-decision-question.entity';
import type { KuTrustRequestDomainEntity } from '../../domain/entities/ku-trust-request.entity';
import type { KuDecisionType } from '../../domain/enums/ku-decision-type.enum';
import type { KuDecisionStatus } from '../../domain/enums/ku-decision-status.enum';
import type {
  ApproveKuTrustedInputDomainInterface,
  CancelKuDecisionInputDomainInterface,
  CloseKuDecisionInputDomainInterface,
  CreateKuDecisionInputDomainInterface,
  DeclineKuTrustedInputDomainInterface,
  ExecKuDecisionInputDomainInterface,
  JoinKuDecisionInputDomainInterface,
  RequestKuTrustedInputDomainInterface,
  StartKuDecisionInputDomainInterface,
  VoteOnKuDecisionInputDomainInterface,
} from '../../domain/interfaces/ku-action-inputs.interface';
import { KuDecisionDTO, KuDecisionFilterInputDTO, KuDecisionQuestionDTO } from '../dto/ku-decision.dto';
import { KuTrustRequestDTO, KuTrustRequestFilterInputDTO } from '../dto/ku-trust-request.dto';
import { DOCUMENT_PORT, type IDocumentPort, type InnerGeneratedDocument, ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { TransactionDTO } from '@coopenomics/extension-kit';
import { HttpApiError } from '@coopenomics/extension-kit';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

/**
 * Сервис собраний и решений кооперативных участков.
 * Действия отправляются в контракт branch с подписью кооператива;
 * чтение — из PG-проекций (история сохраняется после erase в блокчейне).
 */
@Injectable()
export class KuService {
  constructor(
    @Inject(KU_BLOCKCHAIN_PORT) private readonly kuBlockchainPort: KuBlockchainPort,
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchBlockchainPort: BranchBlockchainPort,
    @Inject(KU_DECISION_REPOSITORY) private readonly decisionRepository: KuDecisionRepository,
    @Inject(KU_DECISION_QUESTION_REPOSITORY) private readonly questionRepository: KuDecisionQuestionRepository,
    @Inject(KU_TRUST_REQUEST_REPOSITORY) private readonly trustRequestRepository: KuTrustRequestRepository,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Проверки прав
  // ───────────────────────────────────────────────────────────────────────────

  private assertSameUser(currentUser: IMonoAccount, username: string): void {
    if (currentUser.username !== username) {
      throw new HttpApiError(httpStatus.FORBIDDEN, 'Действие доступно только от своего имени');
    }
  }

  private async getDecisionOrFail(hash: string): Promise<KuDecisionDomainEntity> {
    const decision = await this.decisionRepository.findByHash(hash);
    if (!decision) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Решение собрания участка не найдено');
    }
    return decision;
  }

  private async assertIsDecisionChairman(currentUser: IMonoAccount, hash: string): Promise<void> {
    const decision = await this.getDecisionOrFail(hash);
    if (decision.chairman !== currentUser.username) {
      throw new HttpApiError(httpStatus.FORBIDDEN, 'Действие доступно только председателю собрания');
    }
  }

  private async assertIsDecisionInitiator(currentUser: IMonoAccount, hash: string): Promise<void> {
    const decision = await this.getDecisionOrFail(hash);
    if (decision.initiator !== currentUser.username) {
      throw new HttpApiError(httpStatus.FORBIDDEN, 'Действие доступно только инициатору собрания');
    }
  }

  private async assertIsBranchTrustee(currentUser: IMonoAccount, requestHash: string): Promise<void> {
    const request = await this.trustRequestRepository.findByHash(requestHash);
    if (!request?.braname) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Заявка доверенного не найдена');
    }

    const branch = await this.branchBlockchainPort.getBranch(request.coopname as string, request.braname);
    if (!branch) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Кооперативный участок не найден');
    }

    if (branch.trustee !== currentUser.username) {
      throw new HttpApiError(httpStatus.FORBIDDEN, 'Действие доступно только председателю кооперативного участка');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Действия собрания (контракт branch)
  // ───────────────────────────────────────────────────────────────────────────

  async createDecision(
    data: CreateKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.initiator);
    const result = await this.kuBlockchainPort.createDecision(data);

    // Место и время проведения собрания — приватные данные пайщиков,
    // в блокчейн не публикуются и сохраняются только в БД платформы
    await this.decisionRepository.upsertPrivateData({
      hash: data.hash,
      coopname: data.coopname,
      type: data.type,
      initiator: data.initiator,
      meet_place: data.meet_place,
      meet_at: new Date(data.meet_at),
    });

    return result as unknown as TransactionDTO;
  }

  async joinDecision(
    data: JoinKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.username);
    const result = await this.kuBlockchainPort.joinDecision(data);
    return result as unknown as TransactionDTO;
  }

  async startDecision(
    data: StartKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    // Голосование открывает организатор собрания, назначая председателя
    // из числа присоединившихся участников
    await this.assertIsDecisionInitiator(currentUser, data.hash);

    const decision = await this.getDecisionOrFail(data.hash);
    if (!(decision.participants ?? []).includes(data.chairman)) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Председатель должен быть участником собрания');
    }
    if (decision.type === 'createbranch' && !data.branch_name) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Укажите наименование кооперативного участка');
    }
    // контакты нужны для добавления участка как подразделения после решения совета
    if (decision.type === 'createbranch' && (!data.branch_email || !data.branch_phone)) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Укажите email и телефон кооперативного участка');
    }
    if (decision.type === 'createbranch') {
      const chairmanAccount = await this.accountPort.getAccount(data.chairman);
      if (chairmanAccount.private_account?.type !== AccountType.individual) {
        throw new HttpApiError(
          httpStatus.BAD_REQUEST,
          'Председателем кооперативного участка может быть только физическое лицо'
        );
      }
    }

    // Наименование и контакты участка — приватные данные, в блокчейн не публикуются
    await this.decisionRepository.upsertPrivateData({
      hash: data.hash,
      branch_name: data.branch_name,
      branch_email: data.branch_email,
      branch_phone: data.branch_phone,
    });

    const result = await this.kuBlockchainPort.startDecision(data);
    return result as unknown as TransactionDTO;
  }

  async voteOnDecision(
    data: VoteOnKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.username);
    const result = await this.kuBlockchainPort.voteOnDecision(data);
    return result as unknown as TransactionDTO;
  }

  async closeDecision(
    data: CloseKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    // протокол утверждает председатель собрания — им автоматически является организатор
    await this.assertIsDecisionInitiator(currentUser, data.hash);
    const result = await this.kuBlockchainPort.closeDecision(data);
    return result as unknown as TransactionDTO;
  }

  async execDecision(
    data: ExecKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    // Заявление в совет и договор о материальной ответственности подписывает
    // избранный собранием председатель участка (он же сторона договора)
    await this.assertIsDecisionChairman(currentUser, data.hash);
    const result = await this.kuBlockchainPort.execDecision(data);
    return result as unknown as TransactionDTO;
  }

  async cancelDecision(
    data: CancelKuDecisionInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    await this.assertIsDecisionInitiator(currentUser, data.hash);
    const result = await this.kuBlockchainPort.cancelDecision(data);

    // контракт стирает запись одинаково при любом исходе — факт отмены
    // фиксируем в БД, чтобы отличать «Отменено» от «Завершено»
    await this.decisionRepository.upsertPrivateData({
      hash: data.hash,
      cancelled: true,
    });

    return result as unknown as TransactionDTO;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Доверенные лица
  // ───────────────────────────────────────────────────────────────────────────

  async requestTrusted(
    data: RequestKuTrustedInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.username);
    const result = await this.kuBlockchainPort.requestTrusted(data);
    return result as unknown as TransactionDTO;
  }

  async approveTrusted(
    data: ApproveKuTrustedInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    await this.assertIsBranchTrustee(currentUser, data.hash);
    const result = await this.kuBlockchainPort.approveTrusted(data);
    return result as unknown as TransactionDTO;
  }

  async declineTrusted(
    data: DeclineKuTrustedInputDomainInterface,
    currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    await this.assertIsBranchTrustee(currentUser, data.hash);
    const result = await this.kuBlockchainPort.declineTrusted(data);
    return result as unknown as TransactionDTO;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Генерация документов 320–327
  // ───────────────────────────────────────────────────────────────────────────

  private async generate(
    data: Cooperative.Document.IGenerate,
    registry_id: number,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    data.registry_id = registry_id;
    return await this.documentPort.generate({ data, options: options || {} });
  }

  async generateBranchMeetingProposal(
    data: Cooperative.Registry.BranchMeetingProposal.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchMeetingProposal.registry_id, options);
  }

  async generateBranchMeetingBallot(
    data: Cooperative.Registry.BranchMeetingBallot.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchMeetingBallot.registry_id, options);
  }

  async generateBranchMeetingDecision(
    data: Cooperative.Registry.BranchMeetingDecision.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchMeetingDecision.registry_id, options);
  }

  async generateBranchEstablishmentPetition(
    data: Cooperative.Registry.BranchEstablishmentPetition.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchEstablishmentPetition.registry_id, options);
  }

  async generateBranchEstablishmentDecision(
    data: Cooperative.Registry.BranchEstablishmentSovietDecision.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchEstablishmentSovietDecision.registry_id, options);
  }

  async generateBranchTrustedStatement(
    data: Cooperative.Registry.BranchTrustedStatement.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchTrustedStatement.registry_id, options);
  }

  async generateBranchTrustedLiabilityAgreement(
    data: Cooperative.Registry.BranchTrustedLiabilityAgreement.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchTrustedLiabilityAgreement.registry_id, options);
  }

  async generateBranchTrusteeLiabilityAgreement(
    data: Cooperative.Registry.BranchTrusteeLiabilityAgreement.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchTrusteeLiabilityAgreement.registry_id, options);
  }

  async generateBranchTrusteePowerOfAttorney(
    data: Cooperative.Registry.BranchTrusteePowerOfAttorney.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchTrusteePowerOfAttorney.registry_id, options);
  }

  async generateBranchTrustedPowerOfAttorney(
    data: Cooperative.Registry.BranchTrustedPowerOfAttorney.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    return this.generate(data, Cooperative.Registry.BranchTrustedPowerOfAttorney.registry_id, options);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Запросы
  // ───────────────────────────────────────────────────────────────────────────

  private toDecisionDTO(entity: KuDecisionDomainEntity, questions?: KuDecisionQuestionDomainEntity[]): KuDecisionDTO {
    return {
      hash: entity.hash as string,
      id: entity.id,
      coopname: entity.coopname,
      type: entity.type as KuDecisionType,
      initiator: entity.initiator,
      chairman: entity.chairman,
      status: (entity.present ? entity.status : entity.cancelled ? 'cancelled' : 'completed') as KuDecisionStatus,
      present: entity.present,
      proposal: entity.proposal,
      protocol: entity.protocol,
      petition: entity.petition,
      authorization: entity.authorization,
      open_at: entity.open_at,
      close_at: entity.close_at,
      signed_ballots: entity.signed_ballots,
      braname: entity.braname,
      address: entity.address,
      participants: entity.participants,
      created_at: entity.created_at,
      meet_place: entity.meet_place,
      meet_at: entity.meet_at?.toISOString(),
      branch_name: entity.branch_name,
      branch_email: entity.branch_email,
      branch_phone: entity.branch_phone,
      questions: questions?.map((question) => this.toQuestionDTO(question)),
      block_num: entity.block_num,
    };
  }

  /** Отображаемые имена и типы аккаунтов участников собрания (для выбора председателя по ФИО) */
  private async resolveParticipantsInfo(
    participants: string[]
  ): Promise<{ username: string; display_name: string; account_type: AccountType }[]> {
    return Promise.all(
      participants.map(async (username) => {
        try {
          const account = await this.accountPort.getAccount(username);
          const display_name = await this.accountPort.getDisplayName(username);
          const account_type = (account.private_account?.type as AccountType) ?? AccountType.individual;
          return { username, display_name: display_name || username, account_type };
        } catch {
          return { username, display_name: username, account_type: AccountType.individual };
        }
      })
    );
  }

  private toQuestionDTO(entity: KuDecisionQuestionDomainEntity): KuDecisionQuestionDTO {
    return {
      id: entity.id,
      decision_id: entity.decision_id,
      number: entity.number,
      title: entity.title,
      decision: entity.decision,
      context: entity.context,
      counter_votes_for: entity.counter_votes_for,
      counter_votes_against: entity.counter_votes_against,
      counter_votes_abstained: entity.counter_votes_abstained,
      voters_for: entity.voters_for,
      voters_against: entity.voters_against,
      voters_abstained: entity.voters_abstained,
    };
  }

  private toTrustRequestDTO(entity: KuTrustRequestDomainEntity): KuTrustRequestDTO {
    return {
      hash: entity.hash as string,
      id: entity.id,
      coopname: entity.coopname,
      braname: entity.braname,
      username: entity.username,
      present: entity.present,
      application: entity.application,
      authority: entity.authority,
      block_num: entity.block_num,
    };
  }

  async getDecisions(
    filter?: KuDecisionFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<KuDecisionDTO>> {
    const result = await this.decisionRepository.findAllPaginated(filter, options);

    return {
      ...result,
      items: result.items.map((item) => this.toDecisionDTO(item)),
    };
  }

  async getDecision(hash: string): Promise<KuDecisionDTO> {
    const decision = await this.getDecisionOrFail(hash);

    let questions: KuDecisionQuestionDomainEntity[] = [];
    if (decision.coopname && decision.id !== undefined) {
      questions = await this.questionRepository.findByDecisionId(decision.coopname, decision.id);
      // контракт заменяет черновую повестку при открытии голосования (erase + emplace) —
      // стёртые вопросы остаются в БД с present=false и в повестку не попадают
      questions = questions.filter((question) => question.present);
    }

    const dto = this.toDecisionDTO(decision, questions);
    dto.participants_info = await this.resolveParticipantsInfo(decision.participants ?? []);

    // Протокол собрания пайщиков (323) и решение совета (325) — публикуемые документы
    // для страницы собрания. Договор матответственности (328) и доверенность (329)
    // содержат паспортные данные и сюда НЕ выносятся.
    if (decision.protocol) {
      const aggregate = await this.documents
        .buildAggregate(decision.protocol as unknown as ISignedDocument)
        .catch(() => null);
      dto.protocol_document = aggregate ? new DocumentAggregateDTO(aggregate) : undefined;
    }
    if (decision.authorization) {
      const aggregate = await this.documents
        .buildAggregate(decision.authorization as unknown as ISignedDocument)
        .catch(() => null);
      dto.authorization_document = aggregate ? new DocumentAggregateDTO(aggregate) : undefined;
    }

    return dto;
  }

  async getTrustRequests(
    filter?: KuTrustRequestFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<KuTrustRequestDTO>> {
    const result = await this.trustRequestRepository.findAllPaginated(filter, options);

    const items = await Promise.all(
      result.items.map(async (item) => {
        const dto = this.toTrustRequestDTO(item);
        if (dto.username) {
          dto.display_name = await this.accountPort.getDisplayName(dto.username).catch(() => dto.username);
        }
        // договор заявителя с сертификатами подписантов — председатель смотрит документ
        // и накладывает встречную подпись на него же, без регенерации
        if (item.application) {
          const aggregate = await this.documents
            .buildAggregate(item.application as unknown as ISignedDocument)
            .catch(() => null);
          dto.document = aggregate ? new DocumentAggregateDTO(aggregate) : undefined;
        }
        // доверенность доверенному лицу — председатель так же накладывает встречную подпись
        if (item.authority) {
          const authorityAggregate = await this.documents
            .buildAggregate(item.authority as unknown as ISignedDocument)
            .catch(() => null);
          dto.authority_document = authorityAggregate ? new DocumentAggregateDTO(authorityAggregate) : undefined;
        }
        return dto;
      })
    );

    return {
      ...result,
      items,
    };
  }
}
