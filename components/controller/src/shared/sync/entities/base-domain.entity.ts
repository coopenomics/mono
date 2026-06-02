import type { IBaseDatabaseData } from '../interfaces/base-database.interface';
import { randomUUID } from 'crypto';

/**
 * Базовый класс для доменных сущностей (composite-entity, ADR-008)
 *
 * Story 6.1: введён namespace db/bc для разделения «поля из БД» / «поля из блокчейна»:
 *
 *   class XxxDomainEntity extends BaseDomainEntity<IXxxDatabaseData, IXxxBlockchainData> {
 *     // derived — детерминированный getter в наследнике
 *     get derived() { return { ...computed... }; }
 *   }
 *
 * - `db` хранит то, что приходит из БД (включая локальные неблокчейн-поля).
 * - `bc` хранит nullable снимок последнего блокчейн-состояния. Никогда не писать
 *   в `bc` через `Object.assign(this, ...)` — только через типизированный
 *   `replaceBc(blockchainData, allowedKeys)`.
 * - `block_num`/`present`/`status` остаются на BaseDomainEntity (AC Story 6.1).
 *
 * Backward-compat: legacy наследники `BaseDomainEntity<IXxxDatabaseData>` (без TBc)
 * продолжают компилироваться — `TBc = unknown` по умолчанию, `bc` остаётся undefined.
 */
export abstract class BaseDomainEntity<TDb extends IBaseDatabaseData, TBc = unknown> {
  public _id: string;
  public block_num?: number;
  public present: boolean;
  public status?: string;
  public _created_at: Date;
  public _updated_at: Date;

  public db: TDb;
  public bc?: TBc;

  constructor(databaseData: TDb, defaultStatus?: string) {
    this._id = databaseData._id === '' ? randomUUID().toString() : databaseData._id;

    this.block_num = databaseData.block_num ?? 0;
    this.present = databaseData.present;
    this.status = databaseData.status ?? defaultStatus;
    this._created_at = databaseData._created_at ? new Date(databaseData._created_at) : new Date();
    this._updated_at = databaseData._updated_at ? new Date(databaseData._updated_at) : new Date();

    this.db = { ...databaseData } as TDb;
  }

  updateBase(data: Partial<TDb>): void {
    if (data.block_num !== undefined) this.block_num = data.block_num;
    if (data.present !== undefined) this.present = data.present;
    if (data.status !== undefined) this.status = data.status;
    if (data._created_at !== undefined) this._created_at = data._created_at;
    if (data._updated_at !== undefined) this._updated_at = data._updated_at;
  }
}

/**
 * Типизированное whitelist-присвоение блокчейн-полей в `target.bc` (Story 6.1, ADR-008).
 *
 * Заменяет анти-паттерн `Object.assign(this, blockchainData)` в `updateFromBlockchain`:
 * - `Object.assign` сливал поля в `this` плоско, теряя структурное разделение db/bc.
 * - Whitelist `allowedKeys` фиксирует контракт ровно тех полей, что приходят из
 *   блокчейн-таблицы; лишние ключи в `blockchainData` игнорируются.
 *
 * Вынесено как utility, не метод класса — иначе structural typing ломается там,
 * где `Omit<XxxDomainEntity, ...>` используется в сигнатурах репозиториев (state-repo
 * пр. имеет `Omit<StateDomainEntity, 'id'|'createdAt'|'updatedAt'>`: protected/public
 * метод базы попадает в Omit и не сматчивается с DTO из mapper'а).
 */
export function replaceBc<TBc, K extends keyof TBc>(
  target: { bc?: TBc },
  blockchainData: TBc,
  allowedKeys: ReadonlyArray<K>
): void {
  const next = {} as Pick<TBc, K>;
  for (const key of allowedKeys) {
    next[key] = blockchainData[key];
  }
  target.bc = next as TBc;
}
