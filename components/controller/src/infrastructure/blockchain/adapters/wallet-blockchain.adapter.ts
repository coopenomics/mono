import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from '../blockchain.service';
import { WalletContract, SovietContract } from 'cooptypes';
import { TransactResult } from '@wharfkit/session';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import type {
  WalletBlockchainPort,
  CreateWithdrawDomainInterface,
  GenerateReturnStatementDomainInterface,
  SignProgramAgreementDomainInterface,
} from '~/domain/wallet/ports/wallet-blockchain.port';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IProgramWalletBlockchainData } from '~/domain/wallet/interfaces/program-wallet-blockchain.interface';
import { DomainToBlockchainUtils } from '../../../shared/utils/domain-to-blockchain.utils';

/**
 * Блокчейн адаптер для wallet
 * Реализует взаимодействие с контрактом wallet
 */
@Injectable()
export class WalletBlockchainAdapter implements WalletBlockchainPort {
  private readonly logger = new Logger(WalletBlockchainAdapter.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  /**
   * Создание заявки на вывод средств в контракте wallet
   */
  async createWithdraw(data: CreateWithdrawDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Форматируем quantity к необходимой точности для блокчейна
    const formattedQuantity = this.domainToBlockchainUtils.formatQuantityWithPrecision(data.quantity);

    // Преобразуем доменные данные в формат cooptypes контракта
    const blockchainData: WalletContract.Actions.CreateWithdraw.ICreateWithdraw = {
      coopname: data.coopname,
      username: data.username,
      withdraw_hash: data.withdraw_hash,
      quantity: formattedQuantity,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    const result = (await this.blockchainService.transact({
      account: WalletContract.contractName.production,
      name: WalletContract.Actions.CreateWithdraw.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    this.logger.log(`Создана заявка на вывод средств: ${data.withdraw_hash}`);
    return result;
  }

  /**
   * Подписание программного соглашения пайщиком (Эпик 2 / story 2.1).
   * Кооператив подписывает action своим ключом — wallet::signagree требует
   * `coopname@active`. Document уходит только в action data, не в state.
   */
  async signProgramAgreement(data: SignProgramAgreementDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    const blockchainData: WalletContract.Actions.SignAgreement.ISignAgreement = {
      coopname: data.coopname,
      username: data.username,
      program_id: data.program_id,
      draft_id: data.draft_id,
      document: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.document),
    };

    const result = (await this.blockchainService.transact({
      account: WalletContract.contractName.production,
      name: WalletContract.Actions.SignAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    this.logger.log(
      `wallet::signagree: ${data.coopname}/${data.username} program_id=${data.program_id} draft_id=${data.draft_id}`
    );
    return result;
  }

  /**
   * Генерация заявления на возврат паевого взноса
   */
  async generateReturnStatement(_data: GenerateReturnStatementDomainInterface): Promise<ISignedDocumentDomainInterface> {
    // TODO: Реализовать генерацию заявления через документный сервис
    // Пока возвращаем заглушку
    throw new Error('Метод generateReturnStatement еще не реализован');
  }

  /**
   * Получение данных из wallet контракта
   */
  async getWithdraw(coopname: string, withdraw_hash: string): Promise<WalletContract.Tables.Withdraws.IWithdraws | null> {
    try {
      const withdraws = await this.blockchainService.query(
        WalletContract.contractName.production,
        coopname,
        WalletContract.Tables.Withdraws.tableName,
        {
          indexPosition: 'secondary',
          from: withdraw_hash,
          to: withdraw_hash,
        }
      );

      return withdraws.length > 0 ? withdraws[0] : null;
    } catch (error: any) {
      this.logger.warn(`Не удалось получить withdraw ${withdraw_hash} для ${coopname}: ${error.message}`);
      return null;
    }
  }

  /**
   * Получение всех withdrawals для кооператива
   */
  async getWithdraws(coopname: string): Promise<WalletContract.Tables.Withdraws.IWithdraws[]> {
    return this.blockchainService.getAllRows(
      WalletContract.contractName.production,
      coopname,
      WalletContract.Tables.Withdraws.tableName
    );
  }

  /**
   * Получение всех программных кошельков кооператива
   * Извлекает данные из таблицы progwallets контракта soviet
   */
  async getProgramWallets(coopname: string): Promise<IProgramWalletBlockchainData[]> {
    const wallets = await this.blockchainService.getAllRows<SovietContract.Tables.ProgramWallets.IProgramWallet>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.ProgramWallets.tableName
    );

    return wallets.map((wallet) => ({
      id: wallet.id.toString(),
      coopname: wallet.coopname,
      program_id: wallet.program_id.toString(),
      agreement_id: wallet.agreement_id.toString(),
      username: wallet.username,
      available: wallet.available,
      blocked: wallet.blocked,
      membership_contribution: wallet.membership_contribution,
    }));
  }

  /**
   * Получение программных кошельков пользователя
   * Использует вторичный индекс по username для эффективного поиска
   */
  async getProgramWalletsByUsername(coopname: string, username: string): Promise<IProgramWalletBlockchainData[]> {
    try {
      const wallets = await this.blockchainService.query<SovietContract.Tables.ProgramWallets.IProgramWallet>(
        SovietContract.contractName.production,
        coopname,
        SovietContract.Tables.ProgramWallets.tableName,
        {
          indexPosition: 'secondary', // Индекс 2 - by_username
          from: username,
          to: username,
        }
      );

      return wallets.map((wallet) => ({
        id: wallet.id.toString(),
        coopname: wallet.coopname,
        program_id: wallet.program_id.toString(),
        agreement_id: wallet.agreement_id.toString(),
        username: wallet.username,
        available: wallet.available,
        blocked: wallet.blocked,
        membership_contribution: wallet.membership_contribution,
      }));
    } catch (error: any) {
      this.logger.warn(`Не удалось получить кошельки для пользователя ${username} в ${coopname}: ${error.message}`);
      return [];
    }
  }

  /**
   * Получение конкретного программного кошелька
   * Находит кошелек по username и program_id
   */
  async getProgramWallet(coopname: string, username: string, program_id: string): Promise<IProgramWalletBlockchainData | null> {
    try {
      const wallets = await this.getProgramWalletsByUsername(coopname, username);
      const wallet = wallets.find((w) => w.program_id === program_id);
      return wallet || null;
    } catch (error: any) {
      this.logger.warn(
        `Не удалось получить кошелек программы ${program_id} для пользователя ${username} в ${coopname}: ${error.message}`
      );
      return null;
    }
  }
}
