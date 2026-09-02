export const AUTHENTIK_ADMIN_PORT = Symbol('AuthentikAdminPort');

/**
 * Порт записи в authentik через admin-API (Эпик 11): provisioning учётки пайщика
 * и установка пароля. Нужен для миграции «ключ→пароль» (Story 11.4) и
 * recovery-confirm (Story 12.1). Реализация ходит к authentik по admin-токену;
 * application/domain знают только интерфейс.
 *
 * Инвариант: пароль НЕ хранится и НЕ логируется на стороне controller'а — он
 * прозрачно передаётся в authentik (единственный store паролей пайщиков).
 */
export interface IAuthentikAdminPort {
  /**
   * pk пользователя authentik по точному username, либо null если учётки нет.
   * @throws при сетевой/инфраструктурной недоступности IdP.
   */
  findUserPk(username: string): Promise<number | null>;

  /**
   * username учётки authentik по её uuid (то, что уезжает наружу как `sub`), либо null.
   *
   * Нужен там, где кооператив узнаёт пайщика по идентификатору из CoopID, а не по своему:
   * uuid учётки authentik и id пользователя ядра — разные числа, миграция их не выравнивает.
   * @throws при сетевой/инфраструктурной недоступности IdP.
   */
  findUsernameByUuid(uuid: string): Promise<string | null>;

  /**
   * Гарантирует существование учётки пайщика (создаёт при отсутствии), возвращает pk.
   * Идемпотентно: повторный вызов для существующего username вернёт его pk.
   */
  ensureUser(params: { username: string; email: string; name?: string }): Promise<number>;

  /**
   * Устанавливает пароль пользователю authentik по pk (admin set_password).
   * @throws при ошибке записи/недоступности IdP.
   */
  setPassword(userPk: number, newPassword: string): Promise<void>;
}
