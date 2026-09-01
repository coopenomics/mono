import { Injectable } from '@nestjs/common';
import { TokenDomainService } from '~/domain/token/services/token-domain.service';
import type { TokenPairDomainInterface } from '~/domain/token/interfaces/token-pair-domain.interface';
import type { ServiceTokenDomainInterface } from '~/domain/token/interfaces/service-token-domain.interface';
import type { VerifyTokenInputDomainInterface } from '~/domain/token/interfaces/verify-token-input-domain.interface';
import type { TokenDomainInterface } from '~/domain/token/interfaces/token-domain.interface';
import type { TokenType } from '~/types/token.types';

/**
 * Application service для работы с токенами
 * Координирует работу между domain сервисами и предоставляет высокоуровневый API
 */
@Injectable()
export class TokenApplicationService {
  constructor(private readonly tokenDomainService: TokenDomainService) {}

  /**
   * Генерирует пару токенов авторизации (access + refresh) для пользователя
   * @param userId - ID пользователя
   * @returns Пара токенов
   */
  async generateAuthTokens(userId: string): Promise<TokenPairDomainInterface> {
    return this.tokenDomainService.generateAuthTokens(userId);
  }

  /**
   * Обновляет пару токенов, не меняя личность сессии
   * @param userId - ID пользователя
   * @param sessionId - ID существующей сессии (строки refresh-токена)
   * @returns Пара токенов
   */
  async rotateAuthTokens(userId: string, sessionId: string): Promise<TokenPairDomainInterface> {
    return this.tokenDomainService.rotateAuthTokens(userId, sessionId);
  }

  /**
   * Генерирует сервисный токен доступа для пользователя
   * @param userId - ID пользователя
   * @returns Сервисный токен
   */
  async generateServiceAccessToken(userId: string): Promise<ServiceTokenDomainInterface> {
    return this.tokenDomainService.generateServiceAccessToken(userId);
  }

  /**
   * Генерирует токен сброса ключа для пользователя
   * @param email - email пользователя
   * @param userId - ID пользователя
   * @returns Токен сброса ключа
   */
  async generateResetKeyToken(email: string, userId: string): Promise<string> {
    return this.tokenDomainService.generateResetKeyToken(email, userId);
  }

  /**
   * Генерирует токен приглашения для пользователя
   * @param email - email пользователя
   * @param userId - ID пользователя
   * @returns Токен приглашения
   */
  async generateInviteToken(email: string, userId: string): Promise<string> {
    return this.tokenDomainService.generateInviteToken(email, userId);
  }

  /**
   * Генерирует токен верификации email для пользователя
   * @param userId - ID пользователя
   * @returns Токен верификации email
   */
  async generateVerifyEmailToken(userId: string): Promise<string> {
    return this.tokenDomainService.generateVerifyEmailToken(userId);
  }

  /**
   * Генерирует токен подтверждения выхода из кооператива
   * @param userId - ID пользователя
   * @returns Токен подтверждения выхода
   */
  async generateConfirmExitToken(userId: string): Promise<string> {
    return this.tokenDomainService.generateConfirmExitToken(userId);
  }

  /**
   * Верифицирует токен
   * @param input - данные для верификации
   * @returns Верифицированный токен
   */
  async verifyToken(input: VerifyTokenInputDomainInterface): Promise<TokenDomainInterface> {
    return this.tokenDomainService.verifyToken(input);
  }

  /**
   * Находит активные токены пользователя заданного типа (напр. refresh-сессии для Story 3.7)
   * @param userId - ID пользователя
   * @param type - тип токена
   * @returns Список токенов пользователя
   */
  async findActiveByUser(userId: string, type: TokenType): Promise<TokenDomainInterface[]> {
    return this.tokenDomainService.findByUserIdAndType(userId, type);
  }

  /**
   * Удаляет токены по критериям
   * @param criteria - критерии для удаления
   * @returns Количество удаленных токенов
   */
  async deleteTokens(criteria: Partial<TokenDomainInterface>): Promise<number> {
    return this.tokenDomainService.deleteTokens(criteria);
  }

  /**
   * Удаляет токен по его идентификатору (отзыв конкретной сессии, Story 3.7)
   * @param id - ID строки токена
   * @returns true, если запись была удалена
   */
  async deleteById(id: string): Promise<boolean> {
    return this.tokenDomainService.deleteById(id);
  }

  /**
   * Находит и удаляет токен по значению и типу
   * @param token - значение токена
   * @param type - тип токена
   * @returns Удаленный токен или null
   */
  async findOneAndDelete(token: string, type: TokenType): Promise<TokenDomainInterface | null> {
    return this.tokenDomainService.findOneAndDelete(token, type);
  }

  /**
   * Обновляет токен по ID
   * @param id - ID токена
   * @param updates - поля для обновления
   * @returns Обновленный токен или null
   */
  async updateToken(id: string, updates: Partial<TokenDomainInterface>): Promise<TokenDomainInterface | null> {
    return this.tokenDomainService.updateToken(id, updates);
  }
}
