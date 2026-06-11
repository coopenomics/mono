import { Inject, Injectable } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import type { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { PaginationResult } from '~/application/common/dto/pagination.dto';
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
  SetKuDecisionChairmanInputDomainInterface,
  StartKuDecisionInputDomainInterface,
  VoteOnKuDecisionInputDomainInterface,
} from '../../domain/interfaces/ku-action-inputs.interface';
import { KuDecisionDTO, KuDecisionFilterInputDTO, KuDecisionQuestionDTO } from '../dto/ku-decision.dto';
import { KuTrustRequestDTO, KuTrustRequestFilterInputDTO } from '../dto/ku-trust-request.dto';

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
    private readonly documentDomainService: DocumentDomainService
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Проверки прав
  // ───────────────────────────────────────────────────────────────────────────

  private assertSameUser(currentUser: MonoAccountDomainInterface, username: string): void {
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

  private async assertIsDecisionChairman(currentUser: MonoAccountDomainInterface, hash: string): Promise<void> {
    const decision = await this.getDecisionOrFail(hash);
    if (decision.chairman !== currentUser.username) {
      throw new HttpApiError(httpStatus.FORBIDDEN, 'Действие доступно только председателю собрания');
    }
  }

  private async assertIsDecisionInitiator(currentUser: MonoAccountDomainInterface, hash: string): Promise<void> {
    const decision = await this.getDecisionOrFail(hash);
    if (decision.initiator !== currentUser.username) {
      throw new HttpApiError(httpStatus.FORBIDDEN, 'Действие доступно только инициатору собрания');
    }
  }

  private async assertIsBranchTrustee(currentUser: MonoAccountDomainInterface, requestHash: string): Promise<void> {
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
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.initiator);
    const result = await this.kuBlockchainPort.createDecision(data);
    return result as unknown as TransactionDTO;
  }

  async joinDecision(
    data: JoinKuDecisionInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.username);
    const result = await this.kuBlockchainPort.joinDecision(data);
    return result as unknown as TransactionDTO;
  }

  async setDecisionChairman(
    data: SetKuDecisionChairmanInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    await this.assertIsDecisionInitiator(currentUser, data.hash);
    const result = await this.kuBlockchainPort.setDecisionChairman(data);
    return result as unknown as TransactionDTO;
  }

  async startDecision(
    data: StartKuDecisionInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    await this.assertIsDecisionChairman(currentUser, data.hash);
    const result = await this.kuBlockchainPort.startDecision(data);
    return result as unknown as TransactionDTO;
  }

  async voteOnDecision(
    data: VoteOnKuDecisionInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.username);
    const result = await this.kuBlockchainPort.voteOnDecision(data);
    return result as unknown as TransactionDTO;
  }

  async closeDecision(
    data: CloseKuDecisionInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    await this.assertIsDecisionChairman(currentUser, data.hash);
    const result = await this.kuBlockchainPort.closeDecision(data);
    return result as unknown as TransactionDTO;
  }

  async execDecision(
    data: ExecKuDecisionInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    await this.assertIsDecisionChairman(currentUser, data.hash);
    const result = await this.kuBlockchainPort.execDecision(data);
    return result as unknown as TransactionDTO;
  }

  async cancelDecision(
    data: CancelKuDecisionInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    await this.assertIsDecisionInitiator(currentUser, data.hash);
    const result = await this.kuBlockchainPort.cancelDecision(data);
    return result as unknown as TransactionDTO;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Доверенные лица
  // ───────────────────────────────────────────────────────────────────────────

  async requestTrusted(
    data: RequestKuTrustedInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    this.assertSameUser(currentUser, data.username);
    const result = await this.kuBlockchainPort.requestTrusted(data);
    return result as unknown as TransactionDTO;
  }

  async approveTrusted(
    data: ApproveKuTrustedInputDomainInterface,
    currentUser: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    await this.assertIsBranchTrustee(currentUser, data.hash);
    const result = await this.kuBlockchainPort.approveTrusted(data);
    return result as unknown as TransactionDTO;
  }

  async declineTrusted(
    data: DeclineKuTrustedInputDomainInterface,
    currentUser: MonoAccountDomainInterface
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
  ): Promise<DocumentDomainEntity> {
    data.registry_id = registry_id;
    return await this.documentDomainService.generateDocument({ data, options: options || {} });
  }

  async generateBranchMeetingProposal(
    data: Cooperative.Registry.BranchMeetingProposal.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchMeetingProposal.registry_id, options);
  }

  async generateBranchMeetingJoinStatement(
    data: Cooperative.Registry.BranchMeetingJoinStatement.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchMeetingJoinStatement.registry_id, options);
  }

  async generateBranchMeetingBallot(
    data: Cooperative.Registry.BranchMeetingBallot.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchMeetingBallot.registry_id, options);
  }

  async generateBranchMeetingDecision(
    data: Cooperative.Registry.BranchMeetingDecision.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchMeetingDecision.registry_id, options);
  }

  async generateBranchEstablishmentPetition(
    data: Cooperative.Registry.BranchEstablishmentPetition.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchEstablishmentPetition.registry_id, options);
  }

  async generateBranchTrustedStatement(
    data: Cooperative.Registry.BranchTrustedStatement.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchTrustedStatement.registry_id, options);
  }

  async generateBranchLiabilityAgreement(
    data: Cooperative.Registry.BranchLiabilityAgreement.Action,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<DocumentDomainEntity> {
    return this.generate(data, Cooperative.Registry.BranchLiabilityAgreement.registry_id, options);
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
      status: (entity.present ? entity.status : 'completed') as KuDecisionStatus,
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
      questions: questions?.map((question) => this.toQuestionDTO(question)),
      block_num: entity.block_num,
    };
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
      block_num: entity.block_num,
    };
  }

  async getDecisions(
    filter?: KuDecisionFilterInputDTO,
    options?: PaginationInputDomainInterface
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
    }

    return this.toDecisionDTO(decision, questions);
  }

  async getTrustRequests(
    filter?: KuTrustRequestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResult<KuTrustRequestDTO>> {
    const result = await this.trustRequestRepository.findAllPaginated(filter, options);

    return {
      ...result,
      items: result.items.map((item) => this.toTrustRequestDTO(item)),
    };
  }
}
