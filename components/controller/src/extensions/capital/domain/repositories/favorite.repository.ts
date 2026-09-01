import type { FavoriteTargetType } from '../enums/favorite-target-type.enum';

/** Запись избранного */
export interface IFavorite {
  coopname: string;
  username: string;
  target_type: FavoriteTargetType;
  target_hash: string;
  created_at: Date;
}

/** Избранное, обогащённое живыми данными цели (join к таблицам сущностей) */
export interface IFavoriteWithTarget extends IFavorite {
  /** Актуальное наименование цели */
  title: string;
  /** Хеш родителя: у компонента — проект, у задачи/артефакта — проект или компонент-владелец */
  parent_hash: string | null;
}

export interface FavoriteRepository {
  /** Идемпотентное добавление: повторный вызов не создаёт дубль */
  add(favorite: Omit<IFavorite, 'created_at'>): Promise<void>;
  remove(favorite: Omit<IFavorite, 'created_at'>): Promise<void>;
  /**
   * Избранное пользователя с актуальными наименованиями целей.
   * Записи, чьи цели удалены, в выдачу не попадают.
   */
  findByUserWithTargets(coopname: string, username: string): Promise<IFavoriteWithTarget[]>;
  /** Существует ли цель указанного типа (для валидации добавления) */
  targetExists(target_type: FavoriteTargetType, target_hash: string): Promise<boolean>;
  /**
   * Снятие цели с избранного у всех пайщиков — вызывается при удалении
   * проекта, компонента, задачи или артефакта, чтобы записи не повисали.
   */
  removeAllByTargetHash(target_hash: string): Promise<void>;
}

export const FAVORITE_REPOSITORY = Symbol('FavoriteRepository');
