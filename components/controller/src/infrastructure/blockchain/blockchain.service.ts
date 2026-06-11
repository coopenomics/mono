// infrastructure/blockchain/blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { Action, API, APIClient, Name, PrivateKey, PublicKey } from '@wharfkit/antelope';
import { ContractKit, Table } from '@wharfkit/contract';
import { Session, TransactResult } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';
import { RegistratorContract, SovietContract, SystemContract } from 'cooptypes';
import config from '~/config/config';
import { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { GetInfoResult } from '~/types/shared/blockchain.types';
import type { BlockchainAccountInterface } from '~/types/shared';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';

export type IndexPosition =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'fourth'
  | 'fifth'
  | 'sixth'
  | 'seventh'
  | 'eighth'
  | 'ninth'
  | 'tenth';

@Injectable()
export class BlockchainService implements BlockchainPort {
  private readonly apiClient: APIClient;
  private readonly contractKit: ContractKit;
  private session!: Session;

  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {
    this.apiClient = new APIClient({ url: config.blockchain.url });
    this.contractKit = new ContractKit({ client: this.apiClient });
  }

  public initialize(username: string, wif: string): void {
    this.session = new Session({
      actor: username,
      permission: 'active',
      chain: {
        id: config.blockchain.id,
        url: config.blockchain.url,
      },
      walletPlugin: new WalletPluginPrivateKey(PrivateKey.fromString(wif)),
    });
  }

  public async getInfo(): Promise<GetInfoResult> {
    return (await this.apiClient.v1.chain.get_info()).toJSON();
  }

  public async getAccount(name: string): Promise<BlockchainAccountInterface | null> {
    try {
      const result = (await this.apiClient.v1.chain.get_account(name)).toJSON();
      return result;
    } catch (e) {
      return null;
    }
  }

  /**
   * Ликвидный баланс токена на аккаунте (get_currency_balance), числом.
   * Отсутствие строки баланса = 0. Используется hub-cron'ом биллинга для
   * мониторинга остатка AXON у кооперативов-спиц (Epic 13 v5.1).
   */
  public async getCurrencyBalance(account: string, symbol: string, contract = 'eosio.token'): Promise<number> {
    const rows = (await this.apiClient.v1.chain.get_currency_balance(contract, account, symbol)).map((a) =>
      a.toString(),
    );
    if (!rows.length) return 0;
    const value = parseFloat(rows[0].split(' ')[0]);
    return Number.isFinite(value) ? value : 0;
  }

  public async transact(actionOrActions: any | any[], broadcast = true): Promise<TransactResult> {
    if (Array.isArray(actionOrActions)) {
      return this.sendActions(actionOrActions, broadcast);
    } else {
      return this.sendAction(actionOrActions, broadcast);
    }
  }

  private async formActionFromAbi(action: any): Promise<any> {
    const { abi } = (await this.apiClient.v1.chain.get_abi(action.account)) ?? { abi: undefined };
    return Action.from(action, abi);
  }

  private async sendAction(action: any, broadcast = true): Promise<TransactResult> {
    const formedAction = await this.formActionFromAbi(action);
    return await this.session.transact({ action: formedAction }, { broadcast });
  }

  private async sendActions(actions: any[], broadcast = true): Promise<TransactResult> {
    const data: Action[] = [];
    for (const action of actions) {
      const formedAction = await this.formActionFromAbi(action);
      data.push(formedAction);
    }

    return await this.session.transact({ actions: data }, { broadcast });
  }

  public async getAllRows<T = any>(code: string, scope: string, tableName: string): Promise<any[]> {
    const { abi } = await this.apiClient.v1.chain.get_abi(code);
    if (!abi) throw new Error(`ABI контракта ${code} не найден`);

    const table = new Table({
      abi,
      account: code,
      name: tableName,
      client: this.apiClient,
    });

    const rows = await table.all({ scope });
    return JSON.parse(JSON.stringify(rows)) as T[];
  }

  public async query<T = any>(
    code: string,
    scope: string,
    tableName: string,
    options: {
      indexPosition?: IndexPosition;
      from?: string | number;
      to?: string | number;
      maxRows?: number;
      keyType?: 'name' | 'sha256' | 'i64';
    } = { indexPosition: 'primary', keyType: 'i64' }
  ): Promise<T[]> {
    const { indexPosition = 'primary', from, to, maxRows, keyType } = options;

    const { abi } = await this.apiClient.v1.chain.get_abi(code);
    if (!abi) throw new Error(`ABI контракта ${code} не найден`);

    const table = new Table({
      abi,
      account: code,
      name: tableName,
      client: this.apiClient,
    });
    const rows = await table.all({
      scope,
      index_position: indexPosition,
      key_type: keyType,
      from,
      to,
      maxRows,
    });
    return JSON.parse(JSON.stringify(rows)) as T[];
  }

  public async getSingleRow<T = any>(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: API.v1.TableIndexType,
    indexPosition: IndexPosition = 'primary',
    keyType: keyof API.v1.TableIndexTypes = 'i64'
  ): Promise<T | null> {
    const { abi } = await this.apiClient.v1.chain.get_abi(code);
    if (!abi) throw new Error(`ABI контракта ${code} не найден`);

    const table = new Table({
      abi,
      account: code,
      name: tableName,
      client: this.apiClient,
    });

    const row = await table.get(primaryKey, {
      scope,
      index_position: indexPosition,
      key_type: keyType,
    });

    return row ? (JSON.parse(JSON.stringify(row)) as T) : null;
  }

  // Authentication related methods
  public hasActiveKey(account: BlockchainAccountInterface, publicKey: string): boolean {
    // Преобразуем объект аккаунта в обычный JSON для работы со строками (Wharfkit возвращает свои объекты)
    const accountJson = JSON.parse(JSON.stringify(account));
    const activePermissions = accountJson.permissions.find((p) => p.perm_name === 'active');
    if (!activePermissions) return false;

    // Нормализуем переданный ключ через PublicKey для обеспечения совместимости форматов
    let normalizedPublicKey: string;
    try {
      normalizedPublicKey = PublicKey.from(publicKey).toString();
    } catch (error) {
      // Если не удается нормализовать, используем как есть
      console.warn('Не удалось нормализовать публичный ключ:', error);
      normalizedPublicKey = publicKey;
    }

    const hasKey = activePermissions.required_auth.keys.some((key) => {
      // Проверяем точное совпадение
      if (key.key === normalizedPublicKey) return true;

      // Проверяем совпадение после нормализации ключа из аккаунта
      try {
        const normalizedAccountKey = PublicKey.from(key.key).toString();
        return normalizedAccountKey === normalizedPublicKey;
      } catch (error) {
        // Если не удается нормализовать ключ аккаунта, сравниваем как строки
        return false;
      }
    });

    return hasKey;
  }

  public async getCooperative(coopname: string): Promise<any> {
    const cooperative = await this.getSingleRow(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Cooperatives.tableName,
      Name.from(coopname)
    );
    return cooperative;
  }

  public async changeKey(data: RegistratorContract.Actions.ChangeKey.IChangeKey): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new Error(`Не найден приватный ключ для кооператива ${config.coopname}`);

    this.initialize(config.coopname, wif);

    const actions = [
      {
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.ChangeKey.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    await this.transact(actions);
  }

  public async powerUp(username: string, quantity: string): Promise<string> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(username);
    if (!wif) throw new Error(`Не найден приватный ключ для аккаунта ${username}`);

    this.initialize(username, wif);

    const data: SystemContract.Actions.Powerup.IPowerup = {
      payer: username,
      receiver: username,
      days: 1,
      payment: quantity,
      transfer: false,
    };

    const actions = [
      {
        account: 'eosio',
        name: 'powerup',
        authorization: [
          {
            actor: username,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    // Epic 13 v5.1 (проект «Облачный провайдер»): пропускаем исключения наружу — PowerupPlugin полагается на
    // факт, что отказ on-chain powerup долетает до executePackageTopup и НЕ
    // приводит к recordTopup. Раньше try/catch + logger.info глушил отказ →
    // counters росли, cooldown «использовался», а реальной докупки не было
    // (см. adversarial review 2026-05-30, BLOCKER #1).
    const result = await this.transact(actions);
    const txId = (result as any)?.response?.transaction_id ?? (result as any)?.transaction_id;
    // Round 2: пустой tx_id означает, что транзакция не дошла до chain'а ИЛИ
    // SDK сменил формат ответа. Безопаснее упасть — иначе caller (PowerupPlugin)
    // запишет fallback paymentHash как tx_id, и реконсиляция against on-chain
    // history никогда не сматчит этот платёж (HIGH #4 round 2).
    if (!txId) {
      throw new Error(`powerUp(${username}, ${quantity}): tx_id отсутствует в ответе chain'а`);
    }
    return txId as string;
  }

  public async addUser(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new Error(`Не найден приватный ключ для кооператива ${config.coopname}`);

    this.initialize(config.coopname, wif);

    const actions = [
      {
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.AddUser.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    await this.transact(actions);
  }

  public async createBoard(data: SovietContract.Actions.Boards.CreateBoard.ICreateboard): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new Error(`Не найден приватный ключ для кооператива ${config.coopname}`);

    this.initialize(config.coopname, wif);

    const actions = [
      {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Boards.CreateBoard.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    await this.transact(actions);
  }
}
