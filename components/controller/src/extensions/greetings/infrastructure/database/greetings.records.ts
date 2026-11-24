import type { GreetingAccountType, GreetingSendStatus, GreetingSkipReason, GreetingTemplateStatus } from '../../domain/greetings.enums';

export const TEMPLATES_TABLE = 'greetings_templates';
export const CALENDAR_TABLE = 'greetings_calendar';
export const SENDS_TABLE = 'greetings_sends';

/** Шаблон поздравления председателя. */
export class GreetingTemplateRecord {
  id!: string;
  title!: string;
  /** Первый день периода, `ГГГГ-ММ-ДД`. */
  period_start!: string;
  /** Последний день периода включительно, `ГГГГ-ММ-ДД`. */
  period_end!: string;
  subject!: string;
  /** Текст письма в Markdown с переменными `{{Имя}}`. */
  body!: string;
  status!: GreetingTemplateStatus;
  created_by!: string;
  created_at!: Date;
  updated_at!: Date;
}

/**
 * Строка календаря: день рождения пайщика без личных данных сверх даты.
 * ФИО и почту рассылка читает у ядра в день отправки — так письмо получает
 * свежие данные, а календарь не держит копию личных данных.
 */
export class GreetingCalendarRecord {
  username!: string;
  account_type!: GreetingAccountType;
  birth_year!: number;
  birth_month!: number;
  birth_day!: number;
  updated_at!: Date;
}

/** Строка журнала: поздравление пайщика в конкретном году. */
export class GreetingSendRecord {
  id!: string;
  username!: string;
  year!: number;
  status!: GreetingSendStatus;
  reason!: GreetingSkipReason | null;
  /** Текст ошибки отправки — для журнала председателя. */
  error!: string | null;
  template_id!: string | null;
  /** Название шаблона на момент отправки: шаблон могут удалить. */
  template_title!: string | null;
  /** Тема отправленного письма. */
  subject!: string | null;
  attempts!: number;
  created_at!: Date;
  updated_at!: Date;
}
