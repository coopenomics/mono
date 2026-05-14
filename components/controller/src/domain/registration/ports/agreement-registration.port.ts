import type { AgreementRegistrationSpec } from '../dto/agreement-registration-spec.dto';
import type { ProgramRegistrationSpec } from '../dto/program-registration-spec.dto';

/**
 * Доменный порт, через который расширения регистрируют свои оферты
 * и программы участия в платформе на этапе lifecycle initialize(config).
 *
 * Архитектурное назначение — раздел 4 req 44 проекта 13:
 * ядро НЕ знает о конкретных расширениях, расширения сами наполняют
 * реестр в рантайме. После EXTENSION_APP_TERMINATE_EVENT записи
 * соответствующего расширения автоматически вычищаются реестром.
 *
 * Идемпотентность: повторный register с тем же id (или key) от того
 * же extension_name перезаписывает запись, не дублируя её.
 */
export interface AgreementRegistrationPort {
  /**
   * Зарегистрировать (или обновить) оферту расширения.
   * После вызова оферта становится видна сервисам построения UI/документов
   * и через AgreementConfigurationService.getAgreementsForAccountType.
   */
  registerAgreement(spec: AgreementRegistrationSpec): void;

  /**
   * Снять регистрацию оферты по id и extension_name.
   * Используется редко: основной tear-down делает реестр сам
   * по EXTENSION_APP_TERMINATE_EVENT.
   */
  unregisterAgreement(id: string, extension_name: string): void;

  /**
   * Зарегистрировать (или обновить) программу участия расширения.
   * Программа становится видна в SignUp/SelectProgram через
   * AgreementConfigurationService.getAvailablePrograms.
   */
  registerProgram(spec: ProgramRegistrationSpec): void;

  /**
   * Снять регистрацию программы по key и extension_name.
   */
  unregisterProgram(key: string, extension_name: string): void;
}

/**
 * DI-токен для AgreementRegistrationPort.
 * Расширения инжектируют его как @Inject(AGREEMENT_REGISTRATION_PORT).
 */
export const AGREEMENT_REGISTRATION_PORT = Symbol('AgreementRegistrationPort');
