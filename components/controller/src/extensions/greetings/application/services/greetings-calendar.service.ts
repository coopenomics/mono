import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TableStore, moreOrEqual, moreThan } from '@coopenomics/extension-kit';
import {
  InnerAccountType,
  LOGGER_PORT,
  PARTICIPANT_PROFILE_UPDATED_EVENT,
  PARTICIPANT_REGISTERED_EVENT,
  type ILoggerPort,
  type InnerParticipantProfileUpdatedEvent,
  type InnerParticipantRegisteredEvent,
} from '@coopenomics/innercoop';
import { GREETINGS_CALENDAR_STORE } from '../../infrastructure/database/greetings-stores';
import type { GreetingCalendarRecord } from '../../infrastructure/database/greetings.records';
import { GreetingAccountType } from '../../domain/greetings.enums';
import { birthdaysCelebratedOn, parseBirthdate, type CalendarDate, type MonthDay } from '../../domain/birthday';
import { GreetingsPeopleService } from './greetings-people.service';

/** Размер страницы первого заполнения: на каждого пайщика ядро читает и цепь. */
const FILL_PAGE_SIZE = 25;

const GREETED_TYPES: Record<string, GreetingAccountType> = {
  [InnerAccountType.individual]: GreetingAccountType.INDIVIDUAL,
  [InnerAccountType.entrepreneur]: GreetingAccountType.ENTREPRENEUR,
};

/**
 * Календарь дней рождения — своя выборка приложения с индексом (месяц, день).
 *
 * Заполняется один раз при установке постраничным проходом по пайщикам,
 * дальше живёт событиями ядра: вступление пайщика, загрузка списком, правка
 * личных данных. Организаций в календаре нет: у их представителя даты
 * рождения в данных нет.
 */
@Injectable()
export class GreetingsCalendarService {
  constructor(
    @Inject(GREETINGS_CALENDAR_STORE) private readonly calendar: TableStore<GreetingCalendarRecord>,
    private readonly people: GreetingsPeopleService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(GreetingsCalendarService.name);
  }

  /** Записать дату пайщика; без даты или для организации — убрать из календаря. */
  async upsert(username: string, accountType: string | null, birthdate: string | null): Promise<void> {
    const type = accountType ? GREETED_TYPES[accountType] : undefined;
    const date = parseBirthdate(birthdate);
    if (!type || !date) {
      await this.calendar.delete({ username });
      return;
    }
    await this.calendar.save({
      username,
      account_type: type,
      birth_year: date.year,
      birth_month: date.month,
      birth_day: date.day,
    });
  }

  @OnEvent(PARTICIPANT_PROFILE_UPDATED_EVENT)
  async onProfileUpdated(event: InnerParticipantProfileUpdatedEvent): Promise<void> {
    await this.guard(event.username, () => this.upsert(event.username, event.account_type, event.birthdate));
  }

  /** Кандидат подписал документы вступления: его дата уже в данных ядра. */
  @OnEvent(PARTICIPANT_REGISTERED_EVENT)
  async onRegistered(event: InnerParticipantRegisteredEvent): Promise<void> {
    await this.guard(event.username, async () => {
      const person = await this.people.person(event.username);
      await this.upsert(person.username, person.accountType, person.birthdate);
    });
  }

  /** Ошибка календаря не должна ронять вступление пайщика: пишем в журнал. */
  private async guard(username: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error: unknown) {
      this.logger.error(`Календарь: не удалось обновить дату пайщика ${username}: ${(error as Error).message}`);
    }
  }

  /**
   * Первое заполнение: проход по всем пайщикам по страницам, по очереди.
   * Разовая операция при установке приложения; дальше календарь живёт событиями.
   */
  async fill(): Promise<number> {
    let page = 1;
    let total = 0;
    for (;;) {
      const { people, totalPages } = await this.people.page(page, FILL_PAGE_SIZE);
      for (const person of people) {
        await this.upsert(person.username, person.accountType, person.birthdate);
        if (person.accountType && parseBirthdate(person.birthdate)) total += 1;
      }
      if (page >= totalPages || people.length === 0) return total;
      page += 1;
    }
  }

  /** Именинники даты; 28 февраля невисокосного года — и родившиеся 29-го. */
  async celebratingOn(date: CalendarDate): Promise<GreetingCalendarRecord[]> {
    const days = birthdaysCelebratedOn(date);
    return this.calendar.find(days.map((day) => ({ birth_month: day.month, birth_day: day.day })));
  }

  async month(month: number): Promise<GreetingCalendarRecord[]> {
    return this.calendar.find({ birth_month: month }, { order: { birth_day: 'ASC', username: 'ASC' } });
  }

  async find(username: string): Promise<GreetingCalendarRecord | null> {
    return this.calendar.findOne({ username });
  }

  /** Ближайшие дни рождения, начиная с даты; после декабря — с начала года. */
  async upcoming(from: MonthDay, limit: number): Promise<GreetingCalendarRecord[]> {
    const order = { birth_month: 'ASC', birth_day: 'ASC', username: 'ASC' } as const;
    const ahead = await this.calendar.find(
      [{ birth_month: moreThan(from.month) }, { birth_month: from.month, birth_day: moreOrEqual(from.day) }],
      { order, limit }
    );
    if (ahead.length >= limit) return ahead;
    const wrapped = await this.calendar.find({}, { order, limit: limit - ahead.length });
    const seen = new Set(ahead.map((row) => row.username));
    return [...ahead, ...wrapped.filter((row) => !seen.has(row.username))];
  }

  async count(): Promise<number> {
    return this.calendar.count();
  }
}
