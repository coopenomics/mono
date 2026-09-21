/**
 * Гарантийный срок. Длительность объявляет кооператив в курсе, а отсчёт у
 * каждого свой.
 *
 * Ученик: срок идёт от более поздней из двух дат — начала занятий курса и дня,
 * когда он вписался в курс. Вписавшийся в идущий курс получает свои дни
 * гарантии так же, как пришедший к началу. Продление срок заново не запускает.
 * Пока срок идёт, участник вправе закрыть подписку и получить возврат, поэтому
 * его взнос удержан и на расходы программы не идёт.
 *
 * Преподаватель: срок курса — от начала занятий. Пока он идёт, результаты
 * преподавателя в совет не уходят; вышел — преподаватель начинает получать своё.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

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
  return new Date(new Date(course.starts_at).getTime() + Math.max(0, course.guarantee_days) * DAY_MS);
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

/** Когда кончается гарантийный срок ученика; `null` — курс не активирован, срок ещё впереди. */
export function entryGuaranteeEndsAt(course: GuaranteeTerms, entry: GuaranteeEntry): Date | null {
  if (!course.starts_at) return null;
  const joined = entry.joined_at ?? entry.created_at;
  const from = Math.max(new Date(course.starts_at).getTime(), joined ? new Date(joined).getTime() : 0);
  return new Date(from + Math.max(0, course.guarantee_days) * DAY_MS);
}

/** Идёт ли гарантийный срок ученика по его подписке. */
export function isEntryGuaranteeRunning(course: GuaranteeTerms, entry: GuaranteeEntry, now: Date): boolean {
  if (!(course.guarantee_days > 0)) return false;
  const end = entryGuaranteeEndsAt(course, entry);
  return end === null || now < end;
}
