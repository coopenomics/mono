import type { API } from '@wharfkit/antelope';
import type { IndexPosition } from '~/infrastructure/blockchain/blockchain.service';
import type { BlockchainAccountInterface } from '~/types/shared';
import type { GetInfoResult } from '~/types/shared/blockchain.types';
import type { RegistratorContract, SovietContract } from 'cooptypes';

// domain/common/ports/blockchain.port.ts

/**
 * Результат кворумного чтения активных ключей аккаунта (CoopID, Story 9.7):
 * параллельный опрос нескольких COOPOS RPC для M-of-N консенсуса при обновлении
 * кэша ключей. `agreed=false` при ≥2 расходящихся ответах — кэш обновлять нельзя.
 */
export interface ActiveKeysQuorum {
  /** Узлы сошлись (или доступен лишь один — single-source, проверить нечем). */
  agreed: boolean;
  /** Согласованный нормализованный набор активных ключей (пуст — узлов нет). */
  keys: string[];
  /** Что вернул каждый опрошенный узел (url + его набор ключей) — для аудита. */
  samples: Array<{ url: string; keys: string[] }>;
}

export interface BlockchainPort {
  initialize(username: string, wif: string): void;
  transact(actionOrActions: any | any[], broadcast?: boolean): Promise<any>;
  getInfo(): Promise<GetInfoResult>;
  getAccount(name: string): Promise<BlockchainAccountInterface | null>;
  /**
   * Кворумное чтение активных ключей аккаунта с нескольких COOPOS RPC (Story 9.7):
   * для M-of-N консенсуса при обновлении кэша ключей. См. {@link ActiveKeysQuorum}.
   */
  readActiveKeysQuorum(account: string): Promise<ActiveKeysQuorum>;
  getAllRows(code: string, scope: string, tableName: string): Promise<any[]>;
  getSingleRow(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: API.v1.TableIndexType,
    indexPosition?: IndexPosition,
    keyType?: 'name' | 'sha256' | 'i64'
  ): Promise<any | null>;
  query(
    code: string,
    scope: string,
    tableName: string,
    options: {
      indexPosition?: IndexPosition;
      from?: string | number;
      to?: string | number;
      maxRows?: number;
    }
  ): Promise<any[]>;

  // Authentication related methods
  hasActiveKey(account: any, publicKey: string): boolean;
  /**
   * Восстановить публичный ключ из COOPOS-native recoverable подписи (`SIG_K1_…`)
   * над utf8-сообщением. Зеркало клиентского `signMessage` (SDK signTimestamp,
   * Story 2.4): сервер собирает то же каноническое сообщение и восстанавливает
   * pubkey для сверки с аккаунтом. Крипто инкапсулировано в инфраструктуре —
   * application/auth-v2 не импортирует wharfkit напрямую (гексагональный инвариант).
   */
  recoverPublicKey(message: string, signature: string): string;
  /**
   * Публичный ключ permission `cert` аккаунта (нормализованный `PUB_K1_…`) — звено
   * cert-цепи доверия CoopID (ano→voskhod→vostok). Требует строго single-key
   * (threshold=1, один ключ, без accounts/waits). null — если cert-permission нет
   * или он не single-key. Используется при сборке claim `coop_chain` сертификата.
   */
  getCertPublicKey(accountName: string): Promise<string | null>;
  /**
   * Публикует право заверения `cert` кооператива — строго один ключ без делегирования.
   * Подписывает сам кооператив своим действующим ключом. Вызывается при старте, когда
   * право отсутствует или разошлось с ключом, который держит приложение.
   */
  publishCertPermission(account: string, publicKey: string, signer?: string): Promise<void>;
  /**
   * Вправе ли `steward` распоряжаться аккаунтом `account` — то есть указан ли он в
   * его распорядительных правах как аккаунт (делегирование по имени, не по ключу).
   * Так кооператив получает возможность вести аккаунт АНО, не владея её ключами.
   */
  canManageAccount(account: string, steward: string): Promise<boolean>;
  getCooperative(coopname: string): Promise<any>;
  changeKey(data: RegistratorContract.Actions.ChangeKey.IChangeKey): Promise<void>;

  // Powerup related methods
  powerUp(username: string, quantity: string): Promise<void>;

  // System installation methods
  addUser(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void>;
  createBoard(data: SovietContract.Actions.Boards.CreateBoard.ICreateboard): Promise<void>;
}

export const BLOCKCHAIN_PORT = Symbol('BlockchainPort');
