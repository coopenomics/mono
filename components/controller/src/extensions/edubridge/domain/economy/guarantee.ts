/**
 * Гарантийный срок курса. Он один на курс: идёт от даты начала занятий и длится
 * столько дней, сколько объявил кооператив. Пока срок идёт, участник вправе
 * закрыть подписку и получить возврат, поэтому его взнос удержан и на расходы
 * программы не идёт, а результаты преподавателя в совет не уходят. Срок вышел —
 * взносы становятся свободными, преподаватель начинает получать своё.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GuaranteeTerms {
  /** Дата начала занятий; `null` — курс ещё не активирован. */
  starts_at: Date | string | null;
  /** Гарантийный срок курса, дней; ноль — гарантия не объявлена. */
  guarantee_days: number;
}

/** Когда кончается гарантийный срок; `null` — курс не активирован, дата ещё не известна. */
export function guaranteeEndsAt(course: GuaranteeTerms): Date | null {
  if (!course.starts_at) return null;
  return new Date(new Date(course.starts_at).getTime() + Math.max(0, course.guarantee_days) * DAY_MS);
}

/**
 * Идёт ли гарантийный срок. У неактивированного курса с объявленной гарантией
 * он ещё впереди — значит, идёт: возврат до начала занятий положен целиком.
 */
export function isGuaranteeRunning(course: GuaranteeTerms, now: Date): boolean {
  if (!(course.guarantee_days > 0)) return false;
  const end = guaranteeEndsAt(course);
  return end === null || now < end;
}
