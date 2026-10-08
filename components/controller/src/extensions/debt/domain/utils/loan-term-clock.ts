/**
 * Отсчёт сроков займа на стороне контроллера — зеркало правила контракта
 * (`Debt::Core::due_sec`, `GRACE_SECONDS`).
 *
 * В боевой сети сутки займа — календарные. На стенде с тестовой сборкой
 * контракта сутки идут за минуту, и контроллеру задают ту же длину суток
 * переменной `DEBT_DAY_SECONDS`: иначе он звал бы сверку цепи раз в сутки и
 * не замечал ни просрочки, ни обращения обеспечения.
 */
const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;

/** Длина суток займа в миллисекундах. */
export const LOAN_DAY_MS = (Number(process.env.DEBT_DAY_SECONDS) || 24 * 60 * 60) * 1000;

/** Дней после перехода в просрочку до обращения обеспечения — по договору. */
export const GRACE_DAYS = 5;

/** Срок после перехода в просрочку до обращения обеспечения. */
export const GRACE_MS = GRACE_DAYS * LOAN_DAY_MS;

/** Как часто сверять сроки: раз в сутки займа, на сжатых сутках — дважды за сутки. */
export const DEFAULT_TICK_MS = LOAN_DAY_MS === CALENDAR_DAY_MS ? CALENDAR_DAY_MS : Math.max(LOAN_DAY_MS / 2, 10_000);

/** Время цепи без зоны — это UTC. */
export function chainTime(value?: string): number {
  if (!value || value.startsWith('1970')) return 0;
  return new Date(value.endsWith('Z') ? value : `${value}Z`).getTime();
}

/**
 * Момент, с которого заём считается просроченным. На календарных сутках это
 * срок возврата как он записан; на сжатых срок считается от выдачи.
 */
export function effectiveDue(loan: { due_at?: string; issued_at?: string }): number {
  const due = chainTime(loan.due_at);
  if (LOAN_DAY_MS === CALENDAR_DAY_MS) return due;
  const issued = chainTime(loan.issued_at);
  if (!issued || due <= issued) return due;
  return issued + Math.floor(((due - issued) * LOAN_DAY_MS) / CALENDAR_DAY_MS);
}
