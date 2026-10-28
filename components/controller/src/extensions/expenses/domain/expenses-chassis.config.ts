import { VAT_EXEMPT_NOTE } from '@coopenomics/innercoop';
import { t } from '../i18n';
/**
 * Параметры шасси расходов.
 *
 * `fundNameDative` — фонд, по которому совет согласует списание затрат
 * (строка в служебной записке 2010: «списание затрат по …»). Хранится
 * в дательном падеже, т.к. подставляется после предлога «по». Дефолт —
 * фонд хозяйственной деятельности; другой фонд (развития кооперации,
 * материальной помощи и т.п.) задаётся через env EXPENSES_FUND_NAME.
 */
export const EXPENSES_CHASSIS_CONFIG = {
  fundNameDative: process.env.EXPENSES_FUND_NAME ?? t('expenses.chassisConfig.fundNameDative'),
  /**
   * Назначение платежа для выплат пайщику (SELF/MEMBER) — всегда одно и то же,
   * подставляется автоматически: в платёжке кассира неизменно «аванс под отчёт»,
   * а на что он — видно из описания позиции. Для организации/ИП назначение
   * вводится при создании расхода.
   */
  advancePaymentPurpose: t('expenses.chassisConfig.advancePaymentPurpose'),
};

/**
 * Назначение платежа аванса под отчёт для кассира: «Аванс под отчёт №… НДС не
 * облагается.». Номер — первые 8 знаков хэша позиции: он же хэш платежа в
 * реестре, по нему кассир и пайщик находят платёж. Формат — как у взносов и
 * возвратов ядра; налоговая оговорка — общая константа innercoop.
 */
export function advancePaymentMemo(itemHash: string): string {
  return t('expenses.chassisConfig.advancePaymentMemo', {
    hashPrefix: itemHash.toLowerCase().slice(0, 8),
    vatExemptNote: VAT_EXEMPT_NOTE,
  });
}
