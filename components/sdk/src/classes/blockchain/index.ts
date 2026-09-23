import type { TransactResult } from '@wharfkit/session'
import type { BlockchainConfig, IndexPosition } from '../../types/blockchain/blockchain.types'
import { lt } from '@coopenomics/i18n'
import { Action, type API, APIClient, PrivateKey } from '@wharfkit/antelope'
import { ContractKit, Table } from '@wharfkit/contract'
import { Session } from '@wharfkit/session'
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey'
import { createChainFetch } from '../../utils/chainFetch'

/**
 * Класс Blockchain для взаимодействия с блокчейном COOPOS.
 *
 * Обеспечивает методы для работы с транзакциями, таблицами смарт-контрактов и подписанием через приватный ключ.
 */
export class Blockchain {
  private readonly apiClient: APIClient
  private readonly contractKit: ContractKit
  private session?: Session

  /**
   * Конструктор класса Blockchain.
   * @param config Конфигурация блокчейна, включающая URL цепочки и идентификатор цепочки.
   */
  constructor(private readonly config: BlockchainConfig) {
    this.apiClient = new APIClient({ url: config.chain_url })
    this.contractKit = new ContractKit({ client: this.apiClient })
  }

  /**
   * Получение информации о блокчейне.
   * @returns Объект с информацией о текущем состоянии блокчейна.
   */
  public async getInfo(): Promise<API.v1.GetInfoResponse> {
    return this.apiClient.v1.chain.get_info()
  }

  /**
   * Устанавливает приватный ключ (WIF) для текущей сессии.
   * @param username Имя пользователя (аккаунт).
   * @param wif Приватный ключ в формате WIF.
   * @param permission Тип разрешения, который используется для подписания транзакции (по умолчанию = 'active')
   * @returns Текущий экземпляр Blockchain для цепочного вызова.
   */
  public setWif(username: string, wif: string, permission = 'active'): this {
    const onFailure = this.config.onChainFailure
    this.session = new Session(
      {
        actor: username,
        permission,
        chain: {
          id: this.config.chain_id,
          url: this.config.chain_url,
        },
        walletPlugin: new WalletPluginPrivateKey(PrivateKey.fromString(wif)),
      },
      // Ответ узла виден только здесь: `session.transact` оставляет от него
      // первую строку подробностей без кода исключения и без тела.
      onFailure ? { fetch: createChainFetch(onFailure) } : undefined,
    )

    return this
  }

  /**
   * Выполнение транзакции с передачей одного или нескольких действий.
   * @param actionOrActions Действие или массив действий для выполнения.
   * @param broadcast Если true, транзакция будет отправлена в сеть.
   * @returns Результат выполнения транзакции.
   * @throws Ошибка, если сессия не инициализирована.
   */
  public async transact(actionOrActions: any | any[], broadcast = true): Promise<TransactResult> {
    if (!this.session)
      throw new Error(lt('sdkClient.error.sessionNotInitialized'))

    const actions = Array.isArray(actionOrActions)
      ? await Promise.all(actionOrActions.map(action => this.formActionFromAbi(action)))
      : [await this.formActionFromAbi(actionOrActions)]

    return this.session.transact({ actions }, { broadcast })
  }

  /**
   * Получение всех строк таблицы смарт-контракта.
   * @param code Код (аккаунт) контракта.
   * @param scope Область видимости (scope) таблицы.
   * @param tableName Имя таблицы.
   * @returns Массив строк таблицы.
   */
  public async getAllRows<T = any>(code: string, scope: string, tableName: string): Promise<T[]> {
    const abi = await this.getAbi(code)
    const table = this.createTable(code, tableName, abi)
    const rows = await table.all({ scope })
    return JSON.parse(JSON.stringify(rows)) as T[]
  }

  /**
   * Запрос строк таблицы с использованием фильтров.
   * @param code Код (аккаунт) контракта.
   * @param scope Область видимости (scope) таблицы.
   * @param tableName Имя таблицы.
   * @param options Опции для фильтрации данных.
   * @returns Массив строк, соответствующих фильтрам.
   */
  public async query<T = any>(
    code: string,
    scope: string,
    tableName: string,
    options: {
      indexPosition?: IndexPosition
      from?: string | number
      to?: string | number
      maxRows?: number
    } = { indexPosition: 'primary' },
  ): Promise<T[]> {
    const { indexPosition = 'primary', from, to, maxRows } = options
    const abi = await this.getAbi(code)
    const table = this.createTable(code, tableName, abi)

    const rows = await table.query({
      scope,
      index_position: indexPosition,
      from,
      to,
      maxRows,
    })

    return JSON.parse(JSON.stringify(rows)) as T[]
  }

  /**
   * Получение одной строки таблицы по первичному ключу.
   * @param code Код (аккаунт) контракта.
   * @param scope Область видимости (scope) таблицы.
   * @param tableName Имя таблицы.
   * @param primaryKey Первичный ключ строки.
   * @param indexPosition Индекс для поиска строки (по умолчанию 'primary').
   * @returns Строка таблицы или null, если не найдена.
   */
  public async getRow<T = any>(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: string | number,
    indexPosition: IndexPosition = 'primary',
  ): Promise<T | null> {
    const abi = await this.getAbi(code)
    const table = this.createTable(code, tableName, abi)

    const row = await table.get(String(primaryKey), {
      scope,
      index_position: indexPosition,
    })

    return row ? (JSON.parse(JSON.stringify(row)) as T) : null
  }

  /**
   * Создает объект действия (Action) из ABI контракта.
   * @param action Объект действия.
   * @returns Объект Action.
   */
  private async formActionFromAbi(action: any): Promise<Action> {
    const abi = await this.getAbi(action.account)
    return Action.from(action, abi)
  }

  /**
   * Получение ABI контракта.
   * @param account Код (аккаунт) контракта.
   * @returns ABI контракта.
   * @throws Ошибка, если ABI не найден.
   */
  private async getAbi(account: string): Promise<any> {
    const { abi } = await this.apiClient.v1.chain.get_abi(account)
    if (!abi)
      throw new Error(lt('sdkClient.error.abiNotFound', { account }))
    return abi
  }

  /**
   * Создает объект таблицы (Table) для работы с данными.
   * @param code Код (аккаунт) контракта.
   * @param tableName Имя таблицы.
   * @param abi ABI контракта.
   * @returns Объект Table.
   */
  private createTable(code: string, tableName: string, abi: any): Table {
    return new Table({
      abi,
      account: code,
      name: tableName,
      client: this.apiClient,
    })
  }
}
