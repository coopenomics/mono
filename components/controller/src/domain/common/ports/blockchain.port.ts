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

/**
 * Заверение из цепочки доверия: заверяющий признаёт, что субъект вправе заверять
 * указанным ключом. `credential` — подписанное заверение целиком, то самое, что
 * поедет внутри удостоверения пайщика и позволит проверить цепочку без сети.
 * Остальные поля дублируют подписанное содержимое, чтобы отбирать записи, не
 * разбирая подпись на каждой.
 */
export interface EndorsementRecord {
  issuer: string;
  subject: string;
  chain_id: string;
  cert_key: string;
  expires_at: string;
  credential: string;
}

/**
 * Кооператив, которого обслуживает оператор: его установку оператор развернул и
 * держит, а значит он же продлевает ему заверение. Статус здесь тот же, что в
 * реестре кооперативов, и он решает, продлевать ли: заблокированному заверение
 * гаснет само в пределах своего срока.
 */
export interface ServedCooperative {
  username: string;
  status: string;
}

/** Итог самомиграции ключа узла. */
export type OwnPlatformKeyResult =
  | 'issued' // platform выпущен своим ключом
  | 'exists' // platform уже есть
  | 'no-key' // в хранилище узла нет активного ключа (установка не завершена)
  | 'key-not-active' // ключ хранилища больше не подписывает как active — нужен новый ключ установки
  | 'shared-active'; // в active не только ключ узла — закреплять без участия пайщика нельзя

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
   * Подписывает ли ключ как `active` аккаунта: ключ стоит в `active` напрямую
   * либо в разрешении `platform`, которое входит в `active` вторым входом
   * (ключ узла кооператива, registrator::setplatform). Только для приёма ключа
   * узлом; вход пайщика сверяет ключ через hasActiveKey.
   */
  canSignAsActive(account: any, publicKey: string): boolean;
  /**
   * Самомиграция узла: закрепить свой активный ключ разрешением platform
   * (registrator::setplatform своей подписью), чтобы смена ключа пайщика при
   * восстановлении доступа не остановила узел. Идемпотентно.
   */
  ensureOwnPlatformKey(): Promise<OwnPlatformKeyResult>;
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
   * Единственный ключ именованного разрешения аккаунта — тем же строгим правилом,
   * что и право заверения: один ключ, без делегирования. Так читаются служебные
   * ключи сети — например, ключ подписи уведомлений card.coop на аккаунте АНО.
   */
  getPermissionPublicKey(accountName: string, permission: string): Promise<string | null>;
  /**
   * Публикует право заверения `cert` кооператива — строго один ключ без делегирования.
   * Подписывает сам кооператив своим действующим ключом. Вызывается при старте, когда
   * право отсутствует или разошлось с ключом, который держит приложение.
   */
  publishCertPermission(account: string, publicKey: string, signer?: string): Promise<void>;
  /**
   * Читает заверение субъекта из цепочки доверия. `null` — заверения нет, то есть
   * никто не подтверждал, что субъект вправе выпускать удостоверения.
   */
  getEndorsement(subject: string): Promise<EndorsementRecord | null>;
  /**
   * Кооперативы, которых обслуживает оператор — те, у кого он указан оператором в
   * реестре кооперативов.
   */
  getServedCooperatives(operator: string): Promise<ServedCooperative[]>;
  /**
   * Записывает заверение в цепочку доверия. Подписывает заверяющий — либо сам, либо
   * кооператив, которому переданы его распорядительные права (так подписывают за
   * АНО, не владея её ключами).
   */
  publishEndorsement(endorsement: EndorsementRecord, signer?: string): Promise<void>;

  /**
   * Назначить кооперативу обслуживающего оператора (`registrator::setoperator`).
   * Подписывает оператор — провайдер платформы, которому контракт разрешает это
   * одному. Без оператора кооператив не попадает в обход заверений и остаётся с
   * «Удостоверение не утверждено».
   */
  assignOperator(coopname: string, operator: string): Promise<void>;

  /**
   * Активные кооперативы реестра без оператора (пустой `parent_username`), кроме
   * самого провайдера. Из них провайдер добирает тех, чьё событие активации
   * прошло мимо назначения оператора.
   */
  getUnservedActiveCooperatives(provider: string): Promise<string[]>;
  /**
   * Вправе ли `steward` распоряжаться аккаунтом `account` — то есть указан ли он в
   * его распорядительных правах как аккаунт (делегирование по имени, не по ключу).
   * Так кооператив получает возможность вести аккаунт АНО, не владея её ключами.
   */
  canManageAccount(account: string, steward: string): Promise<boolean>;
  getCooperative(coopname: string): Promise<any>;
  changeKey(data: RegistratorContract.Actions.ChangeKey.IChangeKey): Promise<void>;

  // Powerup related methods
  /**
   * Аренда вычислительных ресурсов из ликвидного AXON-баланса кооператива
   * (подпись coopname@active). Возвращает on-chain transaction_id; бросает
   * исключение при отказе — в т.ч. при нехватке AXON: тогда пакет докупит
   * hub-cron Восхода через billing::converttoaxn подписью _provider
   * (Epic 13 v5.1, решение @ant 2026-06-11).
   */
  powerUp(username: string, quantity: string): Promise<string>;

  // System installation methods
  addUser(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void>;
  createBoard(data: SovietContract.Actions.Boards.CreateBoard.ICreateboard): Promise<void>;
}

export const BLOCKCHAIN_PORT = Symbol('BlockchainPort');
