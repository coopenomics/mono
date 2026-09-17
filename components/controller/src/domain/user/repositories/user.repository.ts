import type { UserDomainEntity } from '../entities/user-domain.entity';
import type {
  CreateUserInputDomainInterface,
  UpdateUserInputDomainInterface,
  UserFilterInputDomainInterface,
} from '../interfaces';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

/**
 * Репозиторий для работы с пользователями
 * Определяет контракт для работы с хранилищем пользователей
 */
export interface UserRepository {
  /**
   * Создает нового пользователя
   * @param userData - данные пользователя
   * @returns созданный пользователь
   */
  create(userData: CreateUserInputDomainInterface): Promise<UserDomainEntity>;

  /**
   * Находит пользователя по ID
   * @param id - ID пользователя
   * @returns пользователь или null, если не найден
   */
  findById(id: string): Promise<UserDomainEntity | null>;

  /**
   * Находит пользователя по имени пользователя
   * @param username - имя пользователя
   * @returns пользователь или null, если не найден
   */
  findByUsername(username: string): Promise<UserDomainEntity | null>;

  /**
   * Находит пользователя по email
   * @param email - email пользователя
   * @returns пользователь или null, если не найден
   */
  findByEmail(email: string): Promise<UserDomainEntity | null>;

  /**
   * Находит пользователя по subscriber_id
   * @param subscriberId - ID подписчика
   * @returns пользователь или null, если не найден
   */
  findBySubscriberId(subscriberId: string): Promise<UserDomainEntity | null>;

  /**
   * Находит пользователя по legacy MongoDB ObjectId
   * @param legacyMongoId - старый ObjectId из MongoDB
   * @returns пользователь или null, если не найден
   */
  findByLegacyMongoId(legacyMongoId: string): Promise<UserDomainEntity | null>;

  /**
   * Проверяет, занят ли email
   * @param email - email для проверки
   * @param excludeUsername - имя пользователя, которого нужно исключить из проверки
   * @returns true, если email занят
   */
  isEmailTaken(email: string, excludeUsername?: string): Promise<boolean>;

  /**
   * Обновляет пользователя по имени пользователя
   * @param username - имя пользователя
   * @param updates - поля для обновления
   * @returns обновленный пользователь или null, если не найден
   */
  updateByUsername(username: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity | null>;

  /**
   * Обновляет пользователя по ID
   * @param id - ID пользователя
   * @param updates - поля для обновления
   * @returns обновленный пользователь или null, если не найден
   */
  updateById(id: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity | null>;

  /**
   * Удаляет пользователя по имени пользователя
   * @param username - имя пользователя
   * @returns true, если пользователь был удален
   */
  deleteByUsername(username: string): Promise<boolean>;

  /**
   * Удаляет пользователя по ID
   * @param id - ID пользователя
   * @returns true, если пользователь был удален
   */
  deleteById(id: string): Promise<boolean>;

  /**
   * Находит пользователей с пагинацией
   * @param filter - фильтр для поиска
   * @param options - опции пагинации
   * @returns результат пагинации с пользователями
   */
  findAllPaginated(
    filter?: UserFilterInputDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<UserDomainEntity>>;

  /** Записать дату вступления (принятия советом); повторная запись не меняет уже известную дату. */
  setJoinedAt(username: string, joinedAt: Date): Promise<void>;

  /** Аккаунты, у которых дата вступления ещё не записана. */
  findUsernamesWithoutJoinedAt(): Promise<string[]>;

  /** Имена аккаунтов пользователей (с отбором по роли) — без загрузки записей. */
  findUsernames(filter?: Pick<UserFilterInputDomainInterface, 'role'>): Promise<string[]>;

  /**
   * Находит пользователей без subscriber_id для синхронизации уведомлений
   * @param limit - ограничение количества результатов
   * @returns массив пользователей
   */
  findUsersWithoutSubscriberId(limit?: number): Promise<UserDomainEntity[]>;

  /**
   * Находит пользователей по роли
   * @param roles - роли для поиска
   * @returns массив пользователей
   */
  findByRoles(roles: string[]): Promise<UserDomainEntity[]>;
}

/**
 * Токен для инъекции зависимости репозитория пользователей
 */
export const USER_REPOSITORY = Symbol('UserRepository');
