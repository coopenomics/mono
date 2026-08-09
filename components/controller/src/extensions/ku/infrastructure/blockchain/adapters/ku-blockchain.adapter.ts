import { Inject, Injectable } from '@nestjs/common';
import { BranchContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import httpStatus from 'http-status';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { HttpApiError } from '~/utils/httpApiError';
import type { KuBlockchainPort } from '../../../domain/interfaces/ku-blockchain.port';
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
} from '../../../domain/interfaces/ku-action-inputs.interface';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';

/**
 * Адаптер блокчейн-порта собраний и решений кооперативных участков.
 * Все действия контракта branch подписываются ключом кооператива из vault.
 */
@Injectable()
export class KuBlockchainAdapter implements KuBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  private async transactAs(coopname: string, name: string, data: Record<string, unknown>): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(coopname, wif);

    return (await this.blockchainService.transact({
      account: BranchContract.contractName.production,
      name,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    })) as TransactResult;
  }

  async createDecision(data: CreateKuDecisionInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.CreateDec.ICreateDec = {
      coopname: data.coopname,
      hash: data.hash,
      type: data.type,
      initiator: data.initiator,
      proposal: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.proposal),
      braname: data.braname,
      agenda: data.agenda,
    };
    return this.transactAs(data.coopname, BranchContract.Actions.CreateDec.actionName, blockchainData as any);
  }

  async joinDecision(data: JoinKuDecisionInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.JoinDec.IJoinDec = {
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
    };
    return this.transactAs(data.coopname, BranchContract.Actions.JoinDec.actionName, blockchainData as any);
  }

  async startDecision(data: StartKuDecisionInputDomainInterface): Promise<TransactResult> {
    // branch_name в блокчейн не уходит — приватное наименование хранится в БД
    const blockchainData: BranchContract.Actions.StartDec.IStartDec = {
      coopname: data.coopname,
      hash: data.hash,
      chairman: data.chairman,
      address: data.address,
      agenda: (data.agenda ?? []).map((point) => ({
        title: point.title,
        decision: point.decision,
        context: point.context ?? '',
      })),
    };
    return this.transactAs(data.coopname, BranchContract.Actions.StartDec.actionName, blockchainData as any);
  }

  async voteOnDecision(data: VoteOnKuDecisionInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.VoteDec.IVoteDec = {
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
      ballot: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.ballot),
      votes: data.votes,
    };
    return this.transactAs(data.coopname, BranchContract.Actions.VoteDec.actionName, blockchainData as any);
  }

  async closeDecision(data: CloseKuDecisionInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.CloseDec.ICloseDec = {
      coopname: data.coopname,
      hash: data.hash,
      protocol: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.protocol),
    };
    return this.transactAs(data.coopname, BranchContract.Actions.CloseDec.actionName, blockchainData as any);
  }

  async execDecision(data: ExecKuDecisionInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.Exec.IExec = {
      coopname: data.coopname,
      hash: data.hash,
      petition: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.petition),
      liability: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.liability),
      authority: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.authority),
    };
    return this.transactAs(data.coopname, BranchContract.Actions.Exec.actionName, blockchainData as any);
  }

  async cancelDecision(data: CancelKuDecisionInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.CancelDec.ICancelDec = {
      coopname: data.coopname,
      hash: data.hash,
      reason: data.reason,
    };
    return this.transactAs(data.coopname, BranchContract.Actions.CancelDec.actionName, blockchainData as any);
  }

  async requestTrusted(data: RequestKuTrustedInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.ReqTrusted.IReqTrusted = {
      coopname: data.coopname,
      braname: data.braname,
      username: data.username,
      hash: data.hash,
      application: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.application),
      authority: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.authority),
    };
    return this.transactAs(data.coopname, BranchContract.Actions.ReqTrusted.actionName, blockchainData as any);
  }

  async approveTrusted(data: ApproveKuTrustedInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.ApprTrusted.IApprTrusted = {
      coopname: data.coopname,
      hash: data.hash,
      countersigned: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.countersigned),
      countersigned_authority: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(
        data.countersigned_authority
      ),
    };
    return this.transactAs(data.coopname, BranchContract.Actions.ApprTrusted.actionName, blockchainData as any);
  }

  async declineTrusted(data: DeclineKuTrustedInputDomainInterface): Promise<TransactResult> {
    const blockchainData: BranchContract.Actions.DeclTrusted.IDeclTrusted = {
      coopname: data.coopname,
      hash: data.hash,
      reason: data.reason,
    };
    return this.transactAs(data.coopname, BranchContract.Actions.DeclTrusted.actionName, blockchainData as any);
  }
}
