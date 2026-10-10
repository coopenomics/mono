/**
 * Гарантийный срок. Длительность объявляет кооператив в курсе; срок один на
 * группу и идёт от начала её занятий (решение владельца 08.10.2026).
 *
 * Ученик: пока срок группы идёт, он вправе подать заявление и получить взнос
 * назад целиком, поэтому взнос удержан и на расходы программы не идёт.
 * Пришедший после окончания срока гарантийных условий не имеет.
 *
 * Преподаватель: пока срок идёт, он подаёт отчёты о занятиях, документов с
 * суммой нет. Срок вышел — сумма за занятия периода считается по оставшимся
 * ученикам, преподаватель подписывает акт и заявление на неё.
 */

const SECONDS_IN_DAY = 24 * 60 * 60;
/** Сутки гарантийного срока на стенде разработки: пять минут. */
const DEV_SECONDS_IN_DAY = 300;

/**
 * Длина суток гарантийного срока, секунд. То же значение уходит в контракт,
 * поэтому срок на сервере и в цепи совпадает.
 *
 *  - В работе (`NODE_ENV=production`, боевая и тестовая сеть) — всегда сутки:
 *    переменная не действует, укоротить срок там нельзя.
 *  - На стенде разработки (`NODE_ENV=development`) — пять минут сами собой:
 *    сценарии «гарантийный срок вышел» проверяются за минуты, помнить о
 *    переключателе не нужно. Переменная `EDUBRIDGE_GUARANTEE_DAY_SECONDS`
 *    задаёт другую длину (86400 — настоящие сутки).
 *  - В тестах — сутки, пока переменная не задана; стенд внешних тестов задаёт её сам.
 */
export function guaranteeDaySeconds(): number {
  if (process.env.NODE_ENV === 'production') return SECONDS_IN_DAY;
  const custom = Number(process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS);
  if (Number.isFinite(custom) && custom > 0) return Math.floor(custom);
  return process.env.NODE_ENV === 'development' ? DEV_SECONDS_IN_DAY : SECONDS_IN_DAY;
}

/** Сутки гарантийного срока укорочены — об этом узел пишет в журнал при запуске расширения. */
export function isGuaranteeDayShortened(): boolean {
  return guaranteeDaySeconds() !== SECONDS_IN_DAY;
}

/** Гарантийный срок курса в секундах — так его хранит контракт. */
export function guaranteeSeconds(course: Pick<GuaranteeTerms, 'guarantee_days'>): number {
  return Math.max(0, Number(course.guarantee_days ?? 0)) * guaranteeDaySeconds();
}

export interface GuaranteeTerms {
  /** Дата начала занятий; `null` — курс ещё не активирован. */
  starts_at: Date | string | null;
  /** Гарантийный срок курса, дней; ноль — гарантия не объявлена. */
  guarantee_days: number;
}

export interface GuaranteeEntry {
  /** Когда ученик вписался в курс — открыл подписку. */
  joined_at?: Date | string | null;
  /** Запасная дата для подписок, открытых до учёта даты вступления. */
  created_at?: Date | string | null;
}

/** Когда кончается гарантийный срок курса; `null` — курс не активирован, дата ещё не известна. */
export function guaranteeEndsAt(course: GuaranteeTerms): Date | null {
  if (!course.starts_at) return null;
  return new Date(new Date(course.starts_at).getTime() + guaranteeSeconds(course) * 1000);
}

/**
 * Идёт ли гарантийный срок курса. У неактивированного курса с объявленной
 * гарантией он ещё впереди — значит, идёт: возврат до начала занятий положен целиком.
 */
export function isGuaranteeRunning(course: GuaranteeTerms, now: Date): boolean {
  if (!(course.guarantee_days > 0)) return false;
  const end = guaranteeEndsAt(course);
  return end === null || now < end;
}

/** Когда кончается гарантийный срок ученика — срок его группы; `null` — группа не активирована, срок ещё впереди. */
export function entryGuaranteeEndsAt(course: GuaranteeTerms, _entry?: GuaranteeEntry): Date | null {
  return guaranteeEndsAt(course);
}

/** Идёт ли гарантийный срок ученика по его подписке — срок его группы. */
export function isEntryGuaranteeRunning(course: GuaranteeTerms, _entry: GuaranteeEntry | null | undefined, now: Date): boolean {
  return isGuaranteeRunning(course, now);
}
