import { Inject, Injectable } from '@nestjs/common';
import { Ledger2Contract, SovietContract } from 'cooptypes';
import httpStatus from 'http-status';
import { HttpApiError } from '@coopenomics/extension-kit';
import {
  CHAIN_PORT,
  VAULT_PORT,
  type IChainPort,
  type IVaultPort,
  type InnerTransactResult,
} from '@coopenomics/innercoop';
import type { WithheldTaxBlockchainPort } from '../../domain/ports/withheld-tax-blockchain.port';

/**
 * Кошелёк удержанного налога — его остаток и есть долг кооператива перед
 * бюджетом.
 *
 * Кошелёк общекооперативный: он один на кооператив и принимает удержания от
 * любой программы, которая выплатила доход физлицу.
 */
const WITHHELD_TAX_WALLET = 'w.sov.ndfl';

/**
 * Доступ стола бухгалтера к цепи в части удержанного налога.
 *
 * Заявка на перечисление подписывается ключом кооператива: контракт требует
 * `check_auth_or_fail(coopname)`, а распоряжается долгом перед бюджетом сам
 * кооператив, а не пайщик-бухгалтер.
 */
@Injectable()
export class WithheldTaxBlockchainAdapter implements WithheldTaxBlockchainPort {
  constructor(
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort
  ) {}

  async getWithheldTaxWalletBalance(coopname: string): Promise<string | null> {
    const rows = await this.chain.getAllRows<{ id: string; available: string }>(
      Ledger2Contract.contractName.production,
      coopname,
      Ledger2Contract.Tables.Wallets.tableName
    );
    return rows.find((row) => row.id === WITHHELD_TAX_WALLET)?.available ?? null;
  }

  async listPendingTaxRequests(
    coopname: string
  ): Promise<SovietContract.Tables.Taxes.ISovietTax[]> {
    return this.chain.getAllRows(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Taxes.tableName
    );
  }

  async createTaxRequest(
    data: SovietContract.Actions.Tax.CreateTax.ICreatetax
  ): Promise<InnerTransactResult> {
    const wif = await this.vault.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для отправки налогового платежа'
      );
    }
    this.chain.initialize(data.coopname, wif);
    return this.chain.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Tax.CreateTax.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }
}
