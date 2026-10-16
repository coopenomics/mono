import type { InnerOrganizationType } from '../core-ports/account.port';

/**
 * Поставщик сведений об организации из государственного реестра страны.
 *
 * Анкета вступления организации спрашивает ИНН первым полем. Если для страны
 * анкеты поставщик зарегистрирован, ядро спрашивает у него сведения и
 * заполняет ими поля анкеты, а пайщик дописывает остальное. Нет поставщика —
 * анкета заполняется вручную.
 *
 * Реестр у каждой страны свой, поэтому поставщик — расширение под одну страну
 * (для России — DaData). Ядро знает поставщиков только по стране: заменить
 * сервис значит поставить другое расширение.
 */

/** Кто подписывает от имени организации — как записано в реестре. */
export interface InnerOrganizationLookupRepresentative {
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  position?: string;
}

/**
 * Сведения из реестра. Пустое поле значит, что реестр его не знает: анкета
 * оставит это поле пайщику.
 */
export interface InnerOrganizationLookupRecord {
  short_name?: string;
  full_name?: string;
  type?: InnerOrganizationType;
  represented_by?: InnerOrganizationLookupRepresentative;
  city?: string;
  /** Юридический адрес. */
  full_address?: string;
  details: {
    inn: string;
    ogrn?: string;
    kpp?: string;
  };
}

export interface IOrganizationLookupHook {
  /** Имя расширения в реестре платформы. */
  readonly extensionName: string;
  /** Страна, чей реестр читает поставщик: значение перечня стран ядра, например `Russia`. */
  readonly country: string;

  /** Организация по ИНН; `null` — реестр такой организации не знает. */
  findByInn(inn: string): Promise<InnerOrganizationLookupRecord | null>;
}

/**
 * Реестр поставщиков. Расширение кладёт себя сюда при запуске, ядро
 * спрашивает по стране. Остановленное расширение ядро снимает само.
 */
export interface IOrganizationLookupRegistryPort {
  register(provider: IOrganizationLookupHook): void;
}

export const ORGANIZATION_LOOKUP_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.OrganizationLookupRegistry');
