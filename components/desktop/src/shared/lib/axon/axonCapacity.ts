import { pluralize, pluralizeDays } from 'src/shared/lib/utils';

/**
 * На что и насколько хватает баланса AXON.
 *
 * Тарифы платформы (стол «Системные ресурсы», расширение powerup): аренда
 * вычислительных ресурсов идёт минимальной квотой 5 AXON в сутки, регистрация
 * одного пайщика стоит 1 AXON, столько же — пакет документов. Считалось это в
 * карточке кошелька на столе ресурсов; та же прикидка нужна и кооперативу на
 * дашборде подключения, поэтому формулы живут здесь, а не двумя копиями.
 */

/** Минимальная суточная квота вычислительных ресурсов. */
export const AXON_MIN_DAILY_QUOTA = 5;

/** Регистрация одного пайщика (и один пакет документов) — 1 AXON. */
export const AXON_PER_ACCOUNT = 1;

/** Сколько суток работы покрывает баланс минимальными квотами. */
export function axonDaysOfWork(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.floor(balance / AXON_MIN_DAILY_QUOTA);
}

/** Сколько регистраций пайщиков (или пакетов документов) покрывает баланс. */
export function axonAccountsAffordable(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.floor(balance / AXON_PER_ACCOUNT);
}

/**
 * Короткая прикидка «на сколько хватит» одной строкой — для карточки кошелька,
 * где места на таблицу нет. Ресурсы конкурируют за один баланс, поэтому «или»:
 * потратить его целиком можно либо на аренду, либо на регистрации. Пустой
 * баланс объяснять нечем.
 */
export function axonCapacitySummary(balance: number): string {
  const days = axonDaysOfWork(balance);
  const accounts = axonAccountsAffordable(balance);
  if (days === 0 && accounts === 0) return '';
  const members = pluralize(accounts, ['пайщик', 'пайщика', 'пайщиков']);
  const packages = pluralize(accounts, ['пакет', 'пакета', 'пакетов']);
  return (
    `Хватит на ≈ ${days} ${pluralizeDays(days)} работы узла ` +
    `или ${accounts} ${members} / ${packages} документов`
  );
}
