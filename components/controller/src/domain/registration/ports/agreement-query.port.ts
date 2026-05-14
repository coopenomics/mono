import type { AccountType } from '~/application/account/enum/account-type.enum';
import type {
  IAgreementConfigItem,
  IRegistrationProgram,
} from '../config/agreement-config.interface';

/**
 * Платформенный порт для чтения зарегистрированных оферт и программ
 * (вне зависимости от того, заданы они в ядре или расширением через
 * AgreementRegistrationPort).
 *
 * Резолверы и расширения должны инжектить этот порт (через
 * AGREEMENT_QUERY_PORT), а не AgreementConfigurationService напрямую,
 * чтобы граница «как читают конфиг» оставалась стабильной даже при
 * перестройке внутренней реализации (например, при выносе кеша или
 * добавлении coop-scoping в Phase 3).
 *
 * Контракт чтения, дополняющий AgreementRegistrationPort (запись):
 *   — оба порта работают со строковыми id/key, не enum;
 *   — applicable_account_types=[] у оферты означает «не показывать
 *     как самостоятельный чекбокс в SignUp» (исторический контракт
 *     GENERATOR_OFFER) — фильтр accountType вернёт пустой список,
 *     а getAgreementsForProgram даст оферту независимо от типа;
 *   — порт не делает coop-scoping (capital не привязан к
 *     конкретному coopname в текущей модели), поэтому coopname в
 *     getAgreementsForAccountType передаётся только для будущего
 *     coop-аддитивного расширения через CooperativeConfigService.
 */
export interface AgreementQueryPort {
  /**
   * Соглашения, требуемые при регистрации пайщика заданного типа
   * аккаунта. Если задан programKey — добавляются оферты программы.
   */
  getAgreementsForAccountType(
    accountType: AccountType,
    coopname?: string,
    programKey?: string
  ): IAgreementConfigItem[];

  /**
   * Оферта по строковому идентификатору, либо null если не найдена.
   */
  getAgreementById(id: string): IAgreementConfigItem | null;

  /**
   * Все оферты, привязанные к программе через её agreement_ids.
   */
  getAgreementsForProgram(programKey: string): IAgreementConfigItem[];

  /**
   * Программы, применимые к типу аккаунта в заданном кооперативе.
   */
  getAvailablePrograms(coopname: string, accountType: AccountType): IRegistrationProgram[];
}

/** DI-токен для AgreementQueryPort при использовании через @Inject(). */
export const AGREEMENT_QUERY_PORT = Symbol('AgreementQueryPort');
