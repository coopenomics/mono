import { FavoriteTargetType } from '../../domain/enums/favorite-target-type.enum';

export const FavoriteEntityName = 'capital_favorites';

/**
 * Личное избранное пайщика: проекты, компоненты, задачи, артефакты.
 * Off-chain, DDL через `synchronize`. Повторное добавление гасится
 * уникальным индексом — запись одна на четвёрку.
 */
export class FavoriteRecord {
  _id!: string;

  coopname!: string;

  username!: string;

  target_type!: FavoriteTargetType;

  target_hash!: string;

  created_at!: Date;
}
