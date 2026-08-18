import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FavoriteTargetType } from '../../domain/enums/favorite-target-type.enum';

export const FavoriteEntityName = 'capital_favorites';

/**
 * Личное избранное пайщика: проекты, компоненты, задачи, артефакты.
 * Off-chain, DDL через `synchronize`. Повторное добавление гасится
 * уникальным индексом — запись одна на четвёрку.
 */
@Entity(FavoriteEntityName)
@Unique(`uq_${FavoriteEntityName}_target`, ['coopname', 'username', 'target_type', 'target_hash'])
@Index(`idx_${FavoriteEntityName}_user`, ['coopname', 'username'])
export class FavoriteTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  _id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'enum', enum: FavoriteTargetType })
  target_type!: FavoriteTargetType;

  @Column({ type: 'varchar', length: 64 })
  target_hash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
