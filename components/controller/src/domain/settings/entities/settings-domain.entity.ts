import type { SettingsDomainInterface } from '../interfaces/settings-domain.interface';

/**
 * Доменная сущность настроек системы
 * Инкапсулирует бизнес-логику работы с настройками
 */
export class SettingsDomainEntity implements SettingsDomainInterface {
  coopname: string;
  provider_name: string;
  authorized_default_workspace: string;
  authorized_default_route: string;
  non_authorized_default_workspace: string;
  non_authorized_default_route: string;
  extra_settings?: Record<string, any>;
  onboarding_completed_at?: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(data: SettingsDomainInterface) {
    this.coopname = data.coopname;
    this.provider_name = data.provider_name;
    this.authorized_default_workspace = data.authorized_default_workspace;
    this.authorized_default_route = data.authorized_default_route;
    this.non_authorized_default_workspace = data.non_authorized_default_workspace;
    this.non_authorized_default_route = data.non_authorized_default_route;
    this.onboarding_completed_at = data.onboarding_completed_at ?? null;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Обновляет настройки частично
   * @param updates - объект с полями для обновления
   */
  update(updates: Partial<Omit<SettingsDomainInterface, 'coopname' | 'created_at' | 'updated_at'>>): void {
    if (updates.onboarding_completed_at !== undefined) {
      this.onboarding_completed_at = updates.onboarding_completed_at;
    }
    if (updates.provider_name !== undefined) {
      this.provider_name = updates.provider_name;
    }
    if (updates.authorized_default_workspace !== undefined) {
      this.authorized_default_workspace = updates.authorized_default_workspace;
    }
    if (updates.authorized_default_route !== undefined) {
      this.authorized_default_route = updates.authorized_default_route;
    }
    if (updates.non_authorized_default_workspace !== undefined) {
      this.non_authorized_default_workspace = updates.non_authorized_default_workspace;
    }
    if (updates.non_authorized_default_route !== undefined) {
      this.non_authorized_default_route = updates.non_authorized_default_route;
    }
    this.updated_at = new Date();
  }

  /**
   * Создает дефолтные настройки для кооператива
   * @param coopname - название кооператива
   */
  static createDefault(coopname: string): SettingsDomainEntity {
    const now = new Date();
    return new SettingsDomainEntity({
      coopname,
      provider_name: 'qrpay',
      authorized_default_workspace: 'participant',
      authorized_default_route: 'wallet',
      non_authorized_default_workspace: 'participant',
      non_authorized_default_route: 'signup',
      created_at: now,
      updated_at: now,
    });
  }
}
