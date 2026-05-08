import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'user_wallets';

/**
 * TypeORM-сущность L3 кошельков (`ledger2::userwallets`, Эпик 3).
 *
 * `id` — глобальный `uint64_t` из блокчейна (auto_increment ledger2-таблицы).
 * Уникальная пара `(coopname, wallet_name, username)` — индекс для быстрого
 * lookup'а по человеко-читаемому ключу (его шлёт UI).
 */
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_wallet_name`, ['wallet_name'])
@Index(`idx_${EntityName}_natural_key`, ['coopname', 'wallet_name', 'username'], { unique: true })
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
