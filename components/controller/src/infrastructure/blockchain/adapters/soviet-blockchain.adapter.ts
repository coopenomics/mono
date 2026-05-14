import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain.service';
import { SovietContract } from 'cooptypes';
import { TransactResult, UInt64 } from '@wharfkit/session';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import type { SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';

@Injectable()
export class SovietBlockchainAdapter implements SovietBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  async getDecisions(coopname: string): Promise<SovietContract.Tables.Decisions.IDecision[]> {
    return this.blockchainService.getAllRows(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Decisions.tableName
    );
  }

  async getDecision(coopname: string, decision_id: string): Promise<SovietContract.Tables.Decisions.IDecision | null> {
    return this.blockchainService.getSingleRow(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Decisions.tableName,
      UInt64.from(decision_id)
    );
  }

  async getCoagreement(
    coopname: string,
    agreement_type: string
  ): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement | null> {
    const rows = await this.getCoagreements(coopname);
    return rows.find((r) => r.type === agreement_type) ?? null;
  }

  async getCoagreements(coopname: string): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement[]> {
    // Per-coop coagreements ~6-7 rows; full scan дешевле, чем uint64-конверсия из name на стороне JS.
    return await this.blockchainService.getAllRows<SovietContract.Tables.CoopAgreements.ICoopAgreement>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.CoopAgreements.tableName
    );
  }

  async getPrograms(coopname: string): Promise<SovietContract.Tables.Programs.IProgram[]> {
    // Per-coop programs ~единицы строк; full scan адекватен.
    return await this.blockchainService.getAllRows<SovietContract.Tables.Programs.IProgram>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Programs.tableName
    );
  }

  async publishProjectOfFreeDecision(
    data: SovietContract.Actions.Decisions.CreateFreeDecision.ICreateFreeDecision
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.CreateFreeDecision.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async cancelExpiredDecision(data: SovietContract.Actions.Decisions.Cancelexprd.ICancelExpired): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Cancelexprd.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async sendAgreement(data: SovietContract.Actions.Agreements.SendAgreement.ISendAgreement): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.SendAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async confirmAgreement(
    data: SovietContract.Actions.Agreements.ConfirmAgreement.IConfirmAgreement
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.ConfirmAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async declineAgreement(
    data: SovietContract.Actions.Agreements.DeclineAgreement.IDeclineAgreement
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.DeclineAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }
}
