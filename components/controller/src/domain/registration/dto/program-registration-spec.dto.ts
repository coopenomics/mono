import type { AccountType } from '~/application/account/enum/account-type.enum';

/**
 * Спецификация программы участия, которую расширение регистрирует
 * через AgreementRegistrationPort.registerProgram() при initialize(config).
 *
 * Программа предъявляется пайщику в SignUp экране SelectProgram
 * (если в кооперативе после фильтрации остаётся >1 программ; 0 — экран
 * пропускается, 1 — выбор автоматический).
 */
export interface ProgramRegistrationSpec {
  /**
   * Уникальный ключ программы в рамках платформы.
   * Строка, потому что расширения сами определяют пространство имён.
   */
  key: string;

  /** Название программы для отображения */
  title: string;

  /** Описание программы */
  description: string;

  /** URL изображения (опционально) */
  image_url?: string;

  /** Минимальные требования (опционально) */
  requirements?: string;

  /** Для каких типов аккаунтов программа применима */
  applicable_account_types: AccountType[];

  /**
   * Идентификаторы оферт (AgreementRegistrationSpec.id),
   * которые должны быть подписаны участником этой программы.
   */
  agreement_ids: string[];

  /** Порядок отображения в SelectProgram */
  order: number;

  /**
   * Имя расширения, зарегистрировавшего программу.
   * Используется для tear-down при EXTENSION_APP_TERMINATE_EVENT.
   */
  extension_name: string;
}
