import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

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
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_wallet_name`, ['wallet_name'])
@Index(`idx_${EntityName}_natural_key`, ['coopname', 'wallet_name', 'username'], { unique: true, where: '"present" = true' })
export class UserWalletTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'varchar', length: 20, unique: true })
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  wallet_name!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'varchar', length: 50 })
  available!: string;

  @Column({ type: 'varchar', length: 50 })
  blocked!: string;
}
