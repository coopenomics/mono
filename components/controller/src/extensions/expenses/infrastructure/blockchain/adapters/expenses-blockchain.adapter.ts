import { Inject, Injectable } from '@nestjs/common'
import { ExpenseContract } from 'cooptypes'
import type { TransactResult } from '@wharfkit/session'
import httpStatus from 'http-status'
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service'
import { VAULT_DOMAIN_SERVICE, VaultDomainService } from '~/domain/vault/services/vault-domain.service'
import { HttpApiError } from '~/utils/httpApiError'
import { ExpensesBlockchainPort } from '../../../domain/interfaces/expenses-blockchain.port'

/**
 * Адаптер блокчейн-порта `expense`. Канон взят с `CapitalBlockchainAdapter`:
 * подпись ключом кооператива (`active` permission), `account = contractName.production`.
 *
 * 6 backend-actions: createexp / payexp / reportexp / returnexp / overspendexp /
 * closeexp (authexp/declexp вызывает контракт soviet по решению совета).
 * Документы document2 (statement) идут как часть `data` action'а — wharfkit
 * сериализует поля по C++ struct document2.
 */
@Injectable()
export class ExpensesBlockchainAdapter implements ExpensesBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  private async initWithCoopKey(coopname: string): Promise<void> {
    const wif = await this.vaultDomainService.getWif(coopname)
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции')
    }
    this.blockchainService.initialize(coopname, wif)
  }

  async createExp(data: ExpenseContract.Actions.CreateExp.ICreateExp): Promise<TransactResult> {
    await this.initWithCoopKey(data.coopname)
    return this.blockchainService.transact({
      account: ExpenseContract.contractName.production,
      name: ExpenseContract.Actions.CreateExp.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    })
  }

  async payExp(data: ExpenseContract.Actions.PayExp.IPayExp): Promise<TransactResult> {
    await this.initWithCoopKey(data.coopname)
    return this.blockchainService.transact({
      account: ExpenseContract.contractName.production,
      name: ExpenseContract.Actions.PayExp.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    })
  }

  async reportExp(data: ExpenseContract.Actions.ReportExp.IReportExp): Promise<TransactResult> {
    await this.initWithCoopKey(data.coopname)
    return this.blockchainService.transact({
      account: ExpenseContract.contractName.production,
      name: ExpenseContract.Actions.ReportExp.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    })
  }

  async returnExp(data: ExpenseContract.Actions.ReturnExp.IReturnExp): Promise<TransactResult> {
    await this.initWithCoopKey(data.coopname)
    return this.blockchainService.transact({
      account: ExpenseContract.contractName.production,
      name: ExpenseContract.Actions.ReturnExp.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    })
  }

  async overspendExp(data: ExpenseContract.Actions.OverspendExp.IOverspendExp): Promise<TransactResult> {
    await this.initWithCoopKey(data.coopname)
    return this.blockchainService.transact({
      account: ExpenseContract.contractName.production,
      name: ExpenseContract.Actions.OverspendExp.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    })
  }

  async closeExp(data: ExpenseContract.Actions.CloseExp.ICloseExp): Promise<TransactResult> {
    await this.initWithCoopKey(data.coopname)
    return this.blockchainService.transact({
      account: ExpenseContract.contractName.production,
      name: ExpenseContract.Actions.CloseExp.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    })
  }
}
