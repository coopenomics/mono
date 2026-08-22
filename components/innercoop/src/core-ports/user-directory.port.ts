/**
 * Справочник пользователей кооператива — учётные имена и роли.
 *
 * Расширение спрашивает, кто есть кто: какая у пайщика роль и кто входит в
 * совет. Это не то же, что учётная запись из `IAccountPort`: там персональные
 * данные и состояние регистрации, здесь — доступ в кооперативе.
 *
 * Порт **не проверяет права**: он сообщает роль, а решение, что она позволяет,
 * принимает вызывающий.
 */

/** Запись справочника. Поля сверх перечисленных доступны через индекс. */
export interface InnerCoopUser {
  username: string;
  email: string;
  /** Роль в кооперативе: `chairman`, `member`, `user`. */
  role: string;
  [key: string]: any;
}

export interface IUserDirectoryPort {
  /** Пользователь по учётному имени; `null`, если такого в кооперативе нет. */
  findByUsername(username: string): Promise<InnerCoopUser | null>;

  /** Пользователи с любой из указанных ролей. */
  findByRoles(roles: string[]): Promise<InnerCoopUser[]>;

  /**
   * Пользователь по идентификатору из токена доступа.
   *
   * Формат идентификатора — дело ядра: у давних пайщиков он остался от прежнего
   * хранилища, у новых это обычный uuid. Расширение про это знать не должно,
   * поэтому разбор живёт здесь. Бросает, если идентификатор не разобран или
   * пользователя нет.
   */
  findBySubject(subject: string): Promise<InnerCoopUser>;
}

export const USER_DIRECTORY_PORT = Symbol.for('Innercoop.CorePort.UserDirectory');
