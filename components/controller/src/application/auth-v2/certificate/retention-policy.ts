/**
 * Политика хранения данных RP (Story 4.8, 152-ФЗ). Единый источник значений для
 * retention-claims сертификата и публичной политики `/.well-known/coopid-claims-policy.json`,
 * чтобы машинное обязательство в удостоверении и его публичное описание не разъезжались.
 */

/** Машинный код обязательства RP: удалить данные пайщика при исключении/по запросу. */
export const DATA_RETENTION_CONTRACT = 'erase_on_exclusion';

/** Срок, за который RP обязан удалить данные после выпуска (дни). */
export const RETENTION_PERIOD_DAYS = 30;

/** Тот же срок в секундах — для `retention_deadline_ts = iat + RETENTION_PERIOD_SECONDS`. */
export const RETENTION_PERIOD_SECONDS = RETENTION_PERIOD_DAYS * 24 * 60 * 60;

/** Версия публикуемой политики claims. */
export const CLAIMS_POLICY_VERSION = '1';

export interface CoopIdClaimsPolicy {
  data_retention_contract: string;
  retention_period_days: number;
  description: string;
  /** Ссылка на договор присоединения кооператива, в котором закреплено обязательство. */
  membership_agreement_url: string;
  policy_version: string;
}

/**
 * Публичная политика claims кооператива (для `/.well-known/coopid-claims-policy.json`).
 * `membership_agreement_url` производится от coopname — отдельного реестра договоров пока нет.
 */
export function buildClaimsPolicy(coopname: string): CoopIdClaimsPolicy {
  return {
    data_retention_contract: DATA_RETENTION_CONTRACT,
    retention_period_days: RETENTION_PERIOD_DAYS,
    description:
      'Приняв participant_certificate, внешний сервис (RP) обязуется удалить персональные данные '
      + 'пайщика при его исключении из кооператива и не позднее retention_deadline_ts. '
      + 'Обязательство закреплено в договоре присоединения кооператива.',
    membership_agreement_url: `https://${coopname}.coop/agreement`,
    policy_version: CLAIMS_POLICY_VERSION,
  };
}
