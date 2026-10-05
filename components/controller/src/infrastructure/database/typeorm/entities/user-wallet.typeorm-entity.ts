import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'user_wallets';

/**
 * TypeORM-сущность L3 кошельков (`ledger2::userwallets`, Эпик 3).
 *
 * `id` — глобальный `uint64_t` из блокчейна (auto_increment ledger2-таблицы).
 * Уникальная пара `(coopname, wallet_name, username)` — partial unique
 * `WHERE present = true`: при обнулении баланса контракт удаляет L3-запись
 * (`cleanup_l3_if_empty`), позже та же пара (coopname, wallet_name, username)
 * может появиться снова уже с новым `id` (контракт берёт следующий
 * `available_primary_key()`). Если индекс держит весь набор — старая
 * present=false запись блокирует upsert новой через unique constraint
 * `idx_user_wallets_natural_key`. С partial индексом удалённые записи
 * выпадают из ограничения, новая может встать рядом.
 */
export class UserWalletTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: string;

  coopname!: string;

  wallet_name!: string;

  username!: string;

  available!: string;

  blocked!: string;
}
