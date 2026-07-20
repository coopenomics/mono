import { Mutations, Zeus } from '@coopenomics/sdk';

/**
 * Пример конфигурации для инициализации кооператива
 * Скопируйте этот файл и заполните реальными данными
 */
export const initConfig: {
  organization_data: Mutations.System.InitSystem.IInput['data']['organization_data'];
} = {
  organization_data: {
    short_name: 'Мой Кооператив',
    full_name: 'Потребительский Кооператив Мой Кооператив',
    type: Zeus.OrganizationType.COOP,
    email: 'info@mycoop.ru',
    phone: '+7 (495) 123-45-67',
    country: 'Российская Федерация',
    city: 'Москва',
    full_address: 'г. Москва, ул. Ленина, д. 1, офис 10',
    fact_address: 'г. Москва, ул. Ленина, д. 1, офис 10',
    details: {
      inn: '1234567890',
      kpp: '123456789',
      ogrn: '1234567890123',
    },
    represented_by: {
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      position: 'Председатель',
      based_on: 'решения общего собрания №1 от 01.01.2024',
    },
    bank_account: {
      bank_name: 'ПАО Сбербанк',
      account_number: '12345678901234567890',
      currency: 'RUB',
      details: {
        bik: '123456789',
        corr: '12345678901234567890',
      },
    },
  },
};

/**
 * Функция для создания кастомной конфигурации
 * Используйте этот шаблон для создания своей конфигурации
 */
export function createCooperativeConfig(customData: Partial<typeof initConfig.organization_data>): typeof initConfig {
  return {
    organization_data: {
      ...initConfig.organization_data,
      ...customData,
    },
  };
}

/**
 * Пример использования:
 *
 * import { initConfig, createCooperativeConfig } from './init-config';
 *
 * // Использование готовой конфигурации
 * console.log(initConfig);
 *
 * // Или создание кастомной конфигурации
 * const myConfig = createCooperativeConfig({
 *   short_name: 'Мой Новый Кооператив',
 *   email: 'info@mynewcoop.ru',
 *   phone: '+7 (812) 555-01-23',
 *   city: 'Санкт-Петербург',
 *   // ... другие поля
 * });
 */
