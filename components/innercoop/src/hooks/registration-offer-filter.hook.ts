import type { InnerAccountType } from '../core-ports/account.port';
import type { InnerAgreementRegistration, InnerProgramRegistration } from '../core-ports/registration.port';

/**
 * Сужение витрины вступления: какие программы и оферты ЧУЖИХ расширений
 * предлагать вступающему пайщику.
 *
 * Та же дисциплина, что у `IDesktopGrantsFilterHook`: ядро показывает
 * пересечение исходного списка со всеми фильтрами, порядок не важен, добавить
 * чужую программу фильтр не может, сбой фильтра трактуется в пользу владельца
 * программы. Собственные программы расширение не фильтрует — оно их
 * регистрирует или нет.
 *
 * Фильтр синхронный: он — политика над реестром в памяти, обращаться наружу
 * ему незачем, а конвейер регистрации ядра синхронный насквозь.
 *
 * Скрытая при вступлении программа не запрещена пайщику навсегда: принять её
 * оферту он может позже со стола расширения-владельца. Пример: «Образовательный
 * мост» не предлагает оферты «Благороста» при вступлении — их подпишет тот, кто
 * станет преподавателем.
 */
export interface InnerRegistrationOfferFilterContext {
  coopname?: string;
  accountType?: InnerAccountType | string;
}

export interface IRegistrationOfferFilterHook {
  /** Имя расширения-автора фильтра в реестре платформы. */
  readonly extensionName: string;

  /** Ключи программ, которые оставить в витрине. */
  filterPrograms(programs: readonly InnerProgramRegistration[], context: InnerRegistrationOfferFilterContext): readonly string[];

  /** Идентификаторы оферт, которые оставить. */
  filterAgreements(
    agreements: readonly InnerAgreementRegistration[],
    context: InnerRegistrationOfferFilterContext
  ): readonly string[];
}

export interface IRegistrationOfferFilterRegistryPort {
  register(filter: IRegistrationOfferFilterHook): void;
  unregister(extensionName: string): void;
}

export const REGISTRATION_OFFER_FILTER_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.RegistrationOfferFilterRegistry');
