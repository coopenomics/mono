export const AUTHN_SESSION_PORT = Symbol('AuthnSessionPort');

/**
 * Порт проверки сессии внешнего IdP (authentik) — первый этап аутентификации.
 * Реализация ходит к authentik по сети; application/domain знают только интерфейс.
 */
export interface IAuthnSessionPort {
  /**
   * Возвращает username аутентифицированного пользователя по его сессии IdP,
   * либо null если сессия отсутствует/недействительна.
   * @throws при сетевой/инфраструктурной недоступности IdP (≠ невалидная сессия).
   */
  resolveUsername(sessionCookie: string): Promise<string | null>;
}
