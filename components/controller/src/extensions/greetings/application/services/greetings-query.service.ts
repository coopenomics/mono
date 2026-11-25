import { Inject, Injectable } from '@nestjs/common';
import { TableStore, oneOf, platformSettings, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { GREETINGS_SEND_STORE } from '../../infrastructure/database/greetings-stores';
import type { GreetingCalendarRecord, GreetingSendRecord } from '../../infrastructure/database/greetings.records';
import { GreetingSendStatus, GreetingTemplateKind, GreetingVariable } from '../../domain/greetings.enums';
import { BIRTHDAY_ONLY_VARIABLES, variableDescription, variableToken } from '../../domain/greeting-letter';
import { chooseTemplate, mailingDateInMonth } from '../../domain/template-choice';
import { ageInYear, celebrationDate, formatDate, localDate } from '../../domain/birthday';
import type { GreetingCalendarEntryDTO, GreetingMailingOccurrenceDTO, GreetingSendDTO, GreetingVariableDTO } from '../dto/greetings.dto';
import { GreetingsCalendarService } from './greetings-calendar.service';
import { GreetingsTemplatesService } from './greetings-templates.service';
import { GreetingsPeopleService } from './greetings-people.service';

/** Предел страницы журнала: журнал растёт на число пайщиков в год. */
const MAX_PAGE_SIZE = 100;

/** Чтение для страниц приложения: календарь, ближайшие дни рождения, журнал. */
@Injectable()
export class GreetingsQueryService {
  constructor(
    @Inject(GREETINGS_SEND_STORE) private readonly sends: TableStore<GreetingSendRecord>,
    private readonly calendar: GreetingsCalendarService,
    private readonly templates: GreetingsTemplatesService,
    private readonly people: GreetingsPeopleService
  ) {}

  variables(): GreetingVariableDTO[] {
    return Object.values(GreetingVariable).map((variable) => ({
      variable,
      token: variableToken(variable),
      description: variableDescription(variable),
      birthdayOnly: BIRTHDAY_ONLY_VARIABLES.includes(variable),
    }));
  }

  /** Дни рождения месяца в заданном году: возраст, итог и шаблон на дату. */
  async month(year: number, month: number): Promise<GreetingCalendarEntryDTO[]> {
    return this.entries(await this.calendar.month(month), year);
  }

  /**
   * Рассылки месяца со счётчиками журнала. Шаблонов у кооператива единицы,
   * поэтому список читается целиком; письма считаются по индексу журнала
   * (шаблон, пайщик, дата).
   */
  async mailings(year: number, month: number): Promise<GreetingMailingOccurrenceDTO[]> {
    const templates = await this.templates.list();
    const result: GreetingMailingOccurrenceDTO[] = [];
    for (const template of templates) {
      const date = mailingDateInMonth(template, year, month);
      if (!date) continue;
      const key = { kind: GreetingTemplateKind.MAILING, template_id: template.id, occasion_date: date };
      result.push({
        template_id: template.id,
        title: template.title,
        subject: template.subject,
        date,
        repeat_yearly: template.repeat_yearly,
        status: template.status,
        completed: template.sent_on === date,
        sent: await this.sends.count({ ...key, status: GreetingSendStatus.SENT }),
        failed: await this.sends.count({ ...key, status: GreetingSendStatus.FAILED }),
      });
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Ближайшие дни рождения от сегодняшнего дня кооператива. */
  async upcoming(limit: number): Promise<GreetingCalendarEntryDTO[]> {
    const today = localDate(new Date(), platformSettings().timezone);
    const rows = await this.calendar.upcoming({ month: today.month, day: today.day }, Math.min(limit, MAX_PAGE_SIZE));
    return this.entries(rows, today.year, today);
  }

  async journal(options?: PaginationInputDTO): Promise<PaginationResult<GreetingSendDTO>> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), MAX_PAGE_SIZE);
    const page = Math.max(options?.page ?? 1, 1);
    const [rows, totalCount] = await this.sends.findAndCount(
      {},
      { order: { updated_at: options?.sortOrder ?? 'DESC' }, limit, offset: (page - 1) * limit }
    );
    const items = await Promise.all(
      rows.map(async (row) => ({ ...row, displayName: await this.people.displayName(row.username) }))
    );
    return { items, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page };
  }

  /**
   * Строки календаря с итогом и шаблоном. `today` задан — год берётся у каждой
   * строки свой: прошедший в этом году день рождения стоит в следующем году.
   */
  private async entries(
    rows: GreetingCalendarRecord[],
    year: number,
    today?: { month: number; day: number }
  ): Promise<GreetingCalendarEntryDTO[]> {
    if (!rows.length) return [];
    const yearOf = (row: GreetingCalendarRecord) => {
      if (!today) return year;
      const passed = row.birth_month < today.month || (row.birth_month === today.month && row.birth_day < today.day);
      return passed ? year + 1 : year;
    };
    const years = [...new Set(rows.map(yearOf))];
    const sends = await this.sends.find({ username: oneOf(rows.map((row) => row.username)), year: oneOf(years) });
    const sendOf = new Map(sends.map((send) => [`${send.username}:${send.year}`, send]));
    const active = await this.templates.active();
    return Promise.all(
      rows.map(async (row) => {
        const rowYear = yearOf(row);
        const date = formatDate(celebrationDate({ month: row.birth_month, day: row.birth_day }, rowYear));
        return {
          username: row.username,
          displayName: await this.people.displayName(row.username),
          account_type: row.account_type,
          month: row.birth_month,
          day: row.birth_day,
          date,
          age: ageInYear(row.birth_year, rowYear),
          send_status: sendOf.get(`${row.username}:${rowYear}`)?.status ?? null,
          template_title: chooseTemplate(active, date)?.title ?? null,
        };
      })
    );
  }
}
