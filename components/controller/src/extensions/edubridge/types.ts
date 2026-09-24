import { z } from 'zod';
import { type DeserializedDescriptionOfExtension } from '@coopenomics/extension-kit';
import { t } from './i18n';

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

/** Устарело: ключи площадок теперь задаются на странице «Площадки» и хранятся зашифрованными в привязке коннектора. Поле читается как запасной источник для стендов с уже введёнными ключами. */
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
  /**
   * Целевой членский взнос кооператива сверх себестоимости курса, проценты.
   * Один на кооператив: покрывает управление программой, издержки и возвраты
   * по Положению ЦПП. По умолчанию 30%.
   */
  markup_percent: number;
}

export const defaultConfig: IConfig = {
  coopAcceptance: { accepted: false, accepted_at: '' },
  connectors: { skillspace_api_key: '', getcourse_account: '', getcourse_api_key: '' },
  expiry_notice_days: 3,
  outbox_interval_sec: 30,
  capital_integration: true,
  markup_percent: 30,
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
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        label: 'Принятие положения ЦПП',
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        note: 'Системное состояние: заполняется решением совета при подключении ЦПП «Образование».',
        visible: false,
      })
    ),
  connectors: z
    .object({
      skillspace_api_key: z
        .string()
        .default('')
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        .describe(describeField({ label: 'Skillspace: API-ключ', note: 'Ключ интеграции площадки Skillspace. Виден только владельцу.', password: true })),
      getcourse_account: z
        .string()
        .default('')
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        .describe(describeField({ label: 'GetCourse: аккаунт', note: 'Имя аккаунта GetCourse (поддомен).' })),
      getcourse_api_key: z
        .string()
        .default('')
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        .describe(describeField({ label: 'GetCourse: API-ключ', note: 'Ключ интеграции площадки GetCourse. Виден только владельцу.', password: true })),
    })
    .default({ skillspace_api_key: '', getcourse_account: '', getcourse_api_key: '' })
    .describe(
      describeField({
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        label: 'Площадки (устарело)',
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        note: 'Ключи площадок задаются на странице «Площадки» стола администратора; здесь — только прежние значения.',
        visible: false,
      })
    ),
  expiry_notice_days: z
    .number()
    .int()
    .min(0)
    .default(3)
    .describe(
      describeField({
        label: t('edubridge.edubridgeExtension.field.expiryNoticeDays.label'),
        note: t('edubridge.edubridgeExtension.field.expiryNoticeDays.hint'),
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
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        label: 'Интервал очереди выдачи доступа, сек',
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        note: 'Как часто проверяется очередь задач выдачи и отзыва доступа на площадках.',
        visible: false,
      })
    ),
  capital_integration: z
    .boolean()
    .default(true)
    .describe(
      describeField({
        label: t('edubridge.edubridgeExtension.field.capitalIntegration.label'),
        note: t('edubridge.edubridgeExtension.field.capitalIntegration.hint'),
      })
    ),
  markup_percent: z
    .number()
    .min(0)
    .max(500)
    .default(30)
    .describe(
      describeField({
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        label: 'Целевой членский взнос, %',
        // i18n-ignore: скрытое служебное поле конфигурации (visible: false), пайщику не показывается
        note: 'Добавляется к себестоимости курса — часам преподавателей по их ставкам. Задаётся в разделе «Экономика» стола администратора.',
        visible: false,
      })
    ),
});
