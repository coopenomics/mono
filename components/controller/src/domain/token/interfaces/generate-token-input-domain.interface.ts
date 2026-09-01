import type { TokenType } from '~/types/token.types';

/**
 * Интерфейс входных данных для генерации токена
 */
export interface GenerateTokenInputDomainInterface {
  userId: string;
  expires: Date;
  type: TokenType;
  secret?: string;
  /**
   * Сессия, которой принадлежит токен (id строки refresh-токена). Попадает в claim
   * `sid` и позволяет завершение сессии сделать действенным: без него access-токен
   * ничем не связан с сессией и продолжает работать после её отзыва.
   */
  sessionId?: string;
}
