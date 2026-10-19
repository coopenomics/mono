/**
 * Доменный интерфейс для настроек системы
 * Содержит конфигурацию рабочих столов и маршрутов по умолчанию
 */
export interface SettingsDomainInterface {
  /**
   * Название кооператива, к которому относятся настройки
   */
  coopname: string;

  /**
   * Имя провайдера платежей по умолчанию
   * Например: 'qrpay', 'yookassa', 'tinkoff'
   */
  provider_name: string;

  /**
   * Рабочий стол по умолчанию для авторизованных пользователей
   * Например: 'participant', 'soviet', 'chairman'
   */
  authorized_default_workspace: string;

  /**
   * Маршрут по умолчанию для авторизованных пользователей
   * Например: 'wallet', 'agenda', 'profile'
   */
  authorized_default_route: string;

  /**
   * Рабочий стол по умолчанию для неавторизованных пользователей
   * Обычно 'participant' или пустой
   */
  non_authorized_default_workspace: string;

  /**
   * Маршрут по умолчанию для неавторизованных пользователей
   * Обычно 'signup' или 'signin'
   */
  non_authorized_default_route: string;

  /**
   * Когда председатель завершил онбординг кооператива; пусто — не завершал.
   * По отметке пункт «Онбординг» уходит из меню председателя.
   */
  onboarding_completed_at?: Date | null;

  /**
   * Дата создания настроек
   */
  created_at: Date;

  /**
   * Дата последнего обновления настроек
   */
  updated_at: Date;
}
