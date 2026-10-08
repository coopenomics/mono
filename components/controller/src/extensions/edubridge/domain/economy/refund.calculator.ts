/**
 * Предварительная сумма возврата членского взноса при отмене подписки — для
 * показа участнику до отмены и записи итога после неё.
 *
 * Сумму возврата считает и проводит контракт (`edubridge::cancelsub`,
 * `Edubridge::refusal_refund`). Здесь то же правило приложено к строке
 * подписки, прочитанной из цепи: остаток оплаты непроведённых занятий ведёт
 * контракт, приложение его не считает.
 *
 * Три основания. До начала занятий участник получает взнос целиком. Кооператив,
 * не набравший группу, отменяет курс — тоже целиком, и сразу в паевой взнос:
 * это отмена его собственного решения. Отказ в ходе подписки возвращает
 * половину остаточной стоимости: доля всего взноса за ещё не проведённое время
 * занятий делится пополам. Проведённое время списывает из резерва подписки
 * контракт — по длительности занятия.
 */

const PRECISION = 4;
const SCALE = 10 ** PRECISION;

/** Основание возврата — от него зависит и сумма, и куда она идёт. */
export enum RefundReason {
  /** Ученик отменил подписку до активации курса. */
  BEFORE_START = 'before_start',
  /** Кооператив отменил курс по недобору. */
  UNDERFILLED = 'underfilled',
  /** Ученик отказался в ходе подписки. */
  REFUSAL = 'refusal',
  /** Совет удовлетворил заявление по гарантийным условиям: вся стоимость, сразу на паевой. */
  GUARANTEE = 'guarantee',
}

/** Состояние подписки в цепи, от которого считается возврат. */
export interface RefundChainState {
  /** Собрано по подписке («9600.0000 RUB»). */
  charged: string;
  /** Остаток оплаты занятий в резерве подписки — за ещё не проведённое время. */
  reserve: string;
  /** Оплата всех оплаченных занятий по плановой ставке: с ней сравнивается остаток резерва. */
  reserve_paid: string;
  /** Занятий оплачено. */
  lessons_paid: number;
  /** Занятий, по которым прошёл расчёт. */
  lessons_done: number;
}

export interface RefundParams {
  /** Строка подписки из цепи. */
  chain: RefundChainState;
  /** Дата начала занятий; `null` — курс ещё не активирован. */
  starts_at: Date | null;
  /** Момент отмены. */
  now: Date;
  /** Отмена по недобору кооператива. */
  underfilled?: boolean;
}

export interface RefundCalculation {
  reason: RefundReason;
  /** Сколько возвращается ученику. */
  refund: string;
  /** Сколько остаётся на кошельке программы. */
  withheld: string;
  /** Занятий оплачено. */
  lessons_paid: number;
  /** Занятий проведено к моменту отмены. */
  lessons_used: number;
  /** Возврат идёт сразу на паевой (отмена решения кооператива). */
  to_share: boolean;
}

export function calculateRefund(params: RefundParams): RefundCalculation {
  const { amount: charged, symbol } = parseAmount(params.chain.charged);
  const base = { lessons_paid: params.chain.lessons_paid, lessons_used: params.chain.lessons_done };
  const whole = (reason: RefundReason, toShare: boolean): RefundCalculation => ({
    reason,
    refund: formatAmount(charged, symbol),
    withheld: formatAmount(0, symbol),
    ...base,
    to_share: toShare,
  });

  if (params.underfilled) return whole(RefundReason.UNDERFILLED, true);
  if (!params.starts_at || params.now < params.starts_at) return whole(RefundReason.BEFORE_START, false);

  // Половина остаточной стоимости: какая доля оплаты занятий осталась в резерве
  // подписки, такая доля взноса не использована. Деление нацело — как в контракте.
  const paid = parseAmount(params.chain.reserve_paid).amount;
  const left = Math.min(parseAmount(params.chain.reserve).amount, paid);
  const residual = paid > 0 && left > 0 ? Number((BigInt(charged) * BigInt(left)) / BigInt(paid)) : 0;
  const refund = Math.floor(residual / 2);
  return {
    reason: RefundReason.REFUSAL,
    refund: formatAmount(refund, symbol),
    withheld: formatAmount(charged - refund, symbol),
    ...base,
    to_share: false,
  };
}

function parseAmount(asset: string): { amount: number; symbol: string } {
  const match = String(asset ?? '').trim().match(/^(\d+(?:\.\d+)?)\s+([A-Z]{1,7})$/);
  if (!match) return { amount: 0, symbol: '' };
  return { amount: Math.round(Number(match[1]) * SCALE), symbol: match[2] };
}

function formatAmount(minor: number, symbol: string): string {
  return `${(minor / SCALE).toFixed(PRECISION)} ${symbol}`;
}
