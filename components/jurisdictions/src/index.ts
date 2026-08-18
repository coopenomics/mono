import { RUSSIA } from './ru';
import { resolveEffective, toIsoDate } from './effective';
import type {
  JurisdictionCode,
  JurisdictionProfile,
  PersonalIncomeTax,
  TaxTransferRequisites,
} from './types';

/**
 * Страновые справочники: что действовало в стране кооператива на конкретную
 * дату — реквизиты бюджета, налоговые коды, часовой пояс расчёта сроков.
 *
 * Пакет намеренно не знает ни про Nest, ни про GraphQL, ни про базу: это
 * данные, которыми пользуются и контроллер, и фабрика документов. Решения на
 * их основе (кому показать, что подставить в отчёт) принимает вызывающий код.
 *
 * Чего здесь нет и не будет: шаблонов документов (они живут в цепи), ставок,
 * которые задаёт сам кооператив, и переводов интерфейса — язык и юрисдикция
 * разные оси, в Беларуси тоже русский, а реквизиты другие.
 */

const PROFILES: Record<JurisdictionCode, JurisdictionProfile> = {
  Russia: RUSSIA,
};

/**
 * Профиль страны. Неизвестная страна — не ошибка: вызывающий код обязан
 * пережить её отсутствием подсказок, а не отказом в работе.
 */
export function getJurisdiction(code: string | null | undefined): JurisdictionProfile | null {
  if (!code) return null;
  return PROFILES[code as JurisdictionCode] ?? null;
}

/** Реквизиты перечисления удержанного налога, действовавшие на дату платежа. */
export function getTaxTransferRequisites(
  code: string | null | undefined,
  on: Date | string
): TaxTransferRequisites | null {
  const profile = getJurisdiction(code);
  return profile ? resolveEffective(profile.taxTransfer, on) : null;
}

/** Ставка и коды НДФЛ, действовавшие на дату выплаты или отчётного периода. */
export function getPersonalIncomeTax(
  code: string | null | undefined,
  on: Date | string
): PersonalIncomeTax | null {
  const profile = getJurisdiction(code);
  return profile ? resolveEffective(profile.personalIncomeTax, on) : null;
}

export { resolveEffective, toIsoDate };
export type {
  EffectiveRecord,
  JurisdictionCode,
  JurisdictionProfile,
  PaymentRequisiteRow,
  PersonalIncomeTax,
  TaxTransferRequisites,
} from './types';
