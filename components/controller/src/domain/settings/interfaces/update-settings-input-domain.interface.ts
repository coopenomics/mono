/**
 * Доменный интерфейс для обновления настроек системы
 * Все поля опциональны для частичного обновления
 */
export interface UpdateSettingsInputDomainInterface {
  /**
   * Имя провайдера платежей по умолчанию
   */
  provider_name?: string;

  /**
   * Рабочий стол по умолчанию для авторизованных пользователей
   */
  authorized_default_workspace?: string;

  /**
   * Маршрут по умолчанию для авторизованных пользователей
   */
  authorized_default_route?: string;

  /**
   * Рабочий стол по умолчанию для неавторизованных пользователей
   */
  non_authorized_default_workspace?: string;

  /**
   * Маршрут по умолчанию для неавторизованных пользователей
   */
  non_authorized_default_route?: string;

  /**
   * Отметка завершения онбординга. Ставит её отдельная операция председателя,
   * через общую форму настроек она не меняется.
   */
  onboarding_completed_at?: Date;
}
