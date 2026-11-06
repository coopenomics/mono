import { Inject, Injectable } from '@nestjs/common';
import { FundContract } from 'cooptypes';
import httpStatus from 'http-status';
import { DomainError } from '@coopenomics/extension-kit';
import {
  CHAIN_PORT,
  VAULT_PORT,
  type IChainPort,
  type IVaultPort,
  type InnerTransactResult,
} from '@coopenomics/innercoop';
import type { FundRegistryBlockchainPort } from '../../domain/ports/fund-registry-blockchain.port';

/**
 * Реестр фондов кооператива в цепи для стола бухгалтера (задача 99D-24).
 *
 * Реестр читается из цепи при запросе, а не из зеркала в базе узла: это пять
 * строк настроек на кооператив, которые меняет только председатель; зеркало по
 * дельтам здесь дало бы таблицу, миграцию и синхронизатор ради пяти строк.
 * Живое обновление страницы идёт по ленте изменений цепи (таблица `fund/funds`
 * объявлена в `ReportsLiveFeedService`).
 */
@Injectable()
export class FundRegistryBlockchainAdapter implements FundRegistryBlockchainPort {
  constructor(
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort
  ) {}

  async listFunds(coopname: string): Promise<FundContract.Tables.Funds.IFund[]> {
    const rows = await this.chain.getAllRows<FundContract.Tables.Funds.IFund>(
      FundContract.contractName.production,
      coopname,
      FundContract.Tables.Funds.tableName
    );
    return rows.sort((a, b) => Number(a.id) - Number(b.id));
  }

  async editFund(data: FundContract.Actions.EditFund.IEditFund): Promise<InnerTransactResult> {
    const wif = await this.vault.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('REPORTS_COOPERATIVE_PRIVATE_KEY_NOT_FOUND', {}, httpStatus.BAD_GATEWAY);
    }
    this.chain.initialize(data.coopname, wif);
    return this.chain.transact({
      account: FundContract.contractName.production,
      name: FundContract.Actions.EditFund.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }
}
