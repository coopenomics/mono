import { z } from 'zod';
import { type DeserializedDescriptionOfExtension } from '@coopenomics/extension-kit';

// Человекочитаемое описание поля для формы установки расширения
// (тот же механизм, что у capital и market).
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

/**
 * Принятие положения ЦПП «Образование» советом кооператива (L1-онбординг).
 * Системное состояние — в форме установки скрыто.
 */
export interface ICoopAcceptanceConfig {
  accepted: boolean;
  accepted_at: string; // ISO-8601, пустая строка = «не принято»
}

/** Ключи площадок-носителей доступа. Секреты — см. configPolicy в реестре. */
export interface IConnectorsConfig {
  skillspace_api_key: string;
  getcourse_account: string;
  getcourse_api_key: string;
}

export interface IConfig {
  coopAcceptance: ICoopAcceptanceConfig;
  connectors: IConnectorsConfig;
  /** За сколько дней до конца оплаченного периода предупреждать пайщика. */
  expiry_notice_days: number;
  /** Интервал воркера очереди выдачи доступа, секунд (архитектура: ≤ 30). */
  outbox_interval_sec: number;
  /** Связка с Благоростом: столы capital — только преподавателям, оферты capital при вступлении скрыты. */
  capital_integration: boolean;
}

export const defaultConfig: IConfig = {
  coopAcceptance: { accepted: false, accepted_at: '' },
  connectors: { skillspace_api_key: '', getcourse_account: '', getcourse_api_key: '' },
  expiry_notice_days: 3,
  outbox_interval_sec: 30,
  capital_integration: true,
};

export const Schema = z.object({
  coopAcceptance: z
    .object({
      accepted: z.boolean().default(false),
      accepted_at: z.string().default(''),
    })
    .default({ accepted: false, accepted_at: '' })
    .describe(
      describeField({
        label: 'Принятие положения ЦПП',
        note: 'Системное состояние: заполняется решением совета при подключении ЦПП «Образование».',
        visible: false,
      })
    ),
  connectors: z
    .object({
      skillspace_api_key: z
        .string()
        .default('')
        .describe(describeField({ label: 'Skillspace: API-ключ', note: 'Ключ интеграции площадки Skillspace. Виден только владельцу.', password: true })),
      getcourse_account: z
        .string()
        .default('')
        .describe(describeField({ label: 'GetCourse: аккаунт', note: 'Имя аккаунта GetCourse (поддомен).' })),
      getcourse_api_key: z
        .string()
        .default('')
        .describe(describeField({ label: 'GetCourse: API-ключ', note: 'Ключ интеграции площадки GetCourse. Виден только владельцу.', password: true })),
    })
    .default({ skillspace_api_key: '', getcourse_account: '', getcourse_api_key: '' })
    .describe(describeField({ label: 'Площадки', note: 'Подключение образовательных площадок — носителей доступа.' })),
  expiry_notice_days: z
    .number()
    .int()
    .min(0)
    .default(3)
    .describe(
      describeField({
        label: 'Предупреждать об окончании доступа, дней',
        note: 'За сколько дней до конца оплаченного периода пайщик получает уведомление, если продления нет.',
      })
    ),
  outbox_interval_sec: z
    .number()
    .int()
    .min(5)
    .max(30)
    .default(30)
    .describe(
      describeField({
        label: 'Интервал очереди выдачи доступа, сек',
        note: 'Как часто проверяется очередь задач выдачи и отзыва доступа на площадках.',
        visible: false,
      })
    ),
  capital_integration: z
    .boolean()
    .default(true)
    .describe(
      describeField({
        label: 'Связать с Благоростом',
        note: 'Если включено и Благорост установлен: его столы видят только преподаватели, его оферты при вступлении не предлагаются.',
      })
    ),
});
