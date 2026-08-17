import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from '../blockchain.service';
import { GatewayContract, WalletContract } from 'cooptypes';
import { TransactResult } from '@wharfkit/session';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import type { GatewayBlockchainPort } from '~/domain/gateway/ports/gateway-blockchain.port';
import type { CompleteIncomeDomainInterface } from '~/domain/gateway/interfaces/complete-income-domain.interface';
import type { CompleteOutcomeDomainInterface } from '~/domain/gateway/interfaces/complete-outcome-domain.interface';
import type { DeclineOutcomeDomainInterface } from '~/domain/gateway/interfaces/decline-outcome-domain.interface';
import { HttpApiError } from '@coopenomics/extension-kit';

/**
 * Блокчейн адаптер для gateway
 * Реализует только управление уже созданными outcomes
 */
@Injectable()
export class GatewayBlockchainAdapter implements GatewayBlockchainPort {
  private readonly logger = new Logger(GatewayBlockchainAdapter.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  /**
   * Завершение исходящего платежа
   */
  async completeOutcome(data: CompleteOutcomeDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Преобразуем доменные данные в формат cooptypes контракта
    const blockchainData: GatewayContract.Actions.CompleteOutcome.ICompleteOutcome = {
      coopname: data.coopname,
      outcome_hash: data.outcome_hash,
    };
    const result = (await this.blockchainService.transact({
      account: GatewayContract.contractName.production,
      name: GatewayContract.Actions.CompleteOutcome.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    this.logger.log(`Завершен исходящий платеж: ${data.outcome_hash}`);
    return result;
  }

  /**
   * Отклонение исходящего платежа
   */
  async declineOutcome(data: DeclineOutcomeDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Преобразуем доменные данные в формат cooptypes контракта
    const blockchainData: GatewayContract.Actions.DeclineOutcome.IOutDecline = {
      coopname: data.coopname,
      outcome_hash: data.outcome_hash,
      reason: data.reason,
    };

    const result = (await this.blockchainService.transact({
      account: GatewayContract.contractName.production,
      name: GatewayContract.Actions.DeclineOutcome.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    this.logger.log(`Отклонен исходящий платеж: ${data.outcome_hash}, причина: ${data.reason}`);
    return result;
  }

  /**
   * Получение исходящих платежей из блокчейна
   */
  async getOutcomes(coopname: string): Promise<GatewayContract.Tables.Outcomes.IOutcome[]> {
    return this.blockchainService.getAllRows(
      GatewayContract.contractName.production,
      coopname,
      GatewayContract.Tables.Outcomes.tableName
    );
  }

  /**
   * Получение конкретного исходящего платежа
   */
  async getOutcome(coopname: string, outcome_hash: string): Promise<GatewayContract.Tables.Outcomes.IOutcome | null> {
    try {
      const outcomes = await this.blockchainService.query(
        GatewayContract.contractName.production,
        coopname,
        GatewayContract.Tables.Outcomes.tableName,
        {
          indexPosition: 'secondary',
          from: outcome_hash,
          to: outcome_hash,
        }
      );

      return outcomes.length > 0 ? outcomes[0] : null;
    } catch (error: any) {
      this.logger.warn(`Не удалось получить outcome ${outcome_hash} для ${coopname}: ${error.message}`);
      return null;
    }
  }

  /**
   * Завершение входящего платежа
   */
  async completeIncome(data: CompleteIncomeDomainInterface): Promise<TransactionResult> {
    // Получаем приватный ключ кооператива
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Формируем данные для создания депозита
    const createDeposit: WalletContract.Actions.CreateDeposit.ICreateDeposit = {
      coopname: data.coopname,
      username: data.username,
      quantity: data.quantity,
      deposit_hash: data.income_hash,
    };

    // Формируем данные для завершения дохода
    const completeDeposit: GatewayContract.Actions.CompleteIncome.ICompleteIncome = {
      coopname: data.coopname,
      income_hash: data.income_hash,
    };

    // Формируем массив действий
    const actions = [
      {
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.CreateDeposit.actionName,
        authorization: [
          {
            actor: data.coopname,
            permission: 'active',
          },
        ],
        data: createDeposit,
      },
      {
        account: GatewayContract.contractName.production,
        name: GatewayContract.Actions.CompleteIncome.actionName,
        authorization: [
          {
            actor: data.coopname,
            permission: 'active',
          },
        ],
        data: completeDeposit,
      },
    ];

    // Выполняем транзакцию
    const result = await this.blockchainService.transact(actions);
    this.logger.log(
      `Входящий платеж завершён: income_hash=${data.income_hash}, username=${data.username}, quantity=${data.quantity}`
    );
    return result;
  }
}
