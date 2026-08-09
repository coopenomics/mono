import type { TokenType } from '~/types/token.types';
import type { TokenDomainInterface } from '../interfaces/token-domain.interface';
import type { CreateTokenInputDomainInterface } from '../interfaces/create-token-input-domain.interface';

/**
 * Репозиторий для работы с токенами
 * Определяет контракт для работы с хранилищем токенов
 */
export interface TokenRepository {
  /**
   * Создает новый токен
   * @param tokenData - данные токена
   * @returns созданный токен
   */
  create(tokenData: CreateTokenInputDomainInterface): Promise<TokenDomainInterface>;

  /**
   * Находит токен по его значению и типу
   * @param token - значение токена
   * @param types - разрешенные типы токенов
   * @returns токен или null, если не найден
   */
  findByTokenAndTypes(token: string, types: TokenType[]): Promise<TokenDomainInterface | null>;

  /**
   * Находит токены по ID пользователя и типу
   * @param userId - ID пользователя
   * @param type - тип токена
   * @returns массив токенов
   */
  findByUserIdAndType(userId: string, type: TokenType): Promise<TokenDomainInterface[]>;

  /**
   * Находит токен по ID
   * @param id - ID токена
   * @returns токен или null, если не найден
   */
  findById(id: string): Promise<TokenDomainInterface | null>;

  /**
   * Удаляет токен по ID
   * @param id - ID токена
   * @returns true, если токен был удален
   */
  deleteById(id: string): Promise<boolean>;

  /**
   * Удаляет токены по критериям
   * @param criteria - критерии для удаления
   * @returns количество удаленных токенов
   */
  deleteMany(criteria: Partial<TokenDomainInterface>): Promise<number>;

  /**
   * Обновляет токен
   * @param id - ID токена
   * @param updates - поля для обновления
   * @returns обновленный токен или null, если не найден
   */
  updateById(id: string, updates: Partial<TokenDomainInterface>): Promise<TokenDomainInterface | null>;

  /**
   * Находит и удаляет токен по его значению и типу
   * @param token - значение токена
   * @param type - тип токена
   * @returns удаленный токен или null, если не найден
   */
  findOneAndDelete(token: string, type: TokenType): Promise<TokenDomainInterface | null>;
}

/**
 * Токен для инъекции зависимости репозитория токенов
 */
export const TOKEN_REPOSITORY = Symbol('TokenRepository');
