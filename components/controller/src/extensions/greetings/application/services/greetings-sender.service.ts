import { Inject, Injectable } from '@nestjs/common';
import { TableStore, platformSettings } from '@coopenomics/extension-kit';
import {
  LOGGER_PORT,
  NOTIFICATION_PORT,
  isEligibleForParticipantMassNotification,
  type ILoggerPort,
  type INotificationPort,
} from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { GREETINGS_SEND_STORE } from '../../infrastructure/database/greetings-stores';
import type { GreetingCalendarRecord, GreetingSendRecord, GreetingTemplateRecord } from '../../infrastructure/database/greetings.records';
import { GreetingSendStatus, GreetingSkipReason } from '../../domain/greetings.enums';
import { ageInYear, formatDate, localDate } from '../../domain/birthday';
import { GreetingsCalendarService } from './greetings-calendar.service';
import { GreetingsTemplatesService } from './greetings-templates.service';
import { GreetingsLetterService } from './greetings-letter.service';
import { GreetingsPeopleService } from './greetings-people.service';

/** Итог одного запуска рассылки — для журнала контроллера и тестов. */
export interface GreetingsRunResult {
  date: string;
  celebrants: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Ежедневная рассылка поздравлений.
 *
 * Запуск идёт каждый час; письма отправляются с часа отправки по времени
 * кооператива. Журнал держит одну строку на пайщика и год: принятое к
 * доставке письмо не повторяется, а пропуск и ошибка повторяются следующим
 * запуском в тот же день — председатель успевает включить шаблон, а сбой
 * доставки не лишает пайщика поздравления.
 */
@Injectable()
export class GreetingsSenderService {
  private running = false;

  constructor(
    @Inject(GREETINGS_SEND_STORE) private readonly sends: TableStore<GreetingSendRecord>,
    private readonly calendar: GreetingsCalendarService,
    private readonly templates: GreetingsTemplatesService,
    private readonly letters: GreetingsLetterService,
    private readonly people: GreetingsPeopleService,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(GreetingsSenderService.name);
  }

  /** Запуск рассылки; до часа отправки и при уже идущем запуске — ничего. */
  async run(sendHour: number, now: Date = new Date()): Promise<GreetingsRunResult | null> {
    const today = localDate(now, platformSettings().timezone);
    if (today.hour < sendHour || this.running) return null;
    this.running = true;
    try {
      const date = formatDate(today);
      const celebrants = await this.calendar.celebratingOn(today);
      const result: GreetingsRunResult = { date, celebrants: celebrants.length, sent: 0, skipped: 0, failed: 0 };
      if (!celebrants.length) return result;
      const template = await this.templates.forDate(date);
      for (const entry of celebrants) {
        const status = await this.greet(entry, today.year, template);
        if (status === GreetingSendStatus.SENT) result.sent += 1;
        if (status === GreetingSendStatus.SKIPPED) result.skipped += 1;
        if (status === GreetingSendStatus.FAILED) result.failed += 1;
      }
      this.logger.info(`Поздравления ${date}: именинников ${result.celebrants}, отправлено ${result.sent}`, result);
      return result;
    } finally {
      this.running = false;
    }
  }

  /** Поздравить одного пайщика; возвращает итог либо `null`, если уже поздравлен. */
  async greet(entry: GreetingCalendarRecord, year: number, template: GreetingTemplateRecord | null): Promise<GreetingSendStatus | null> {
    const existing = await this.sends.findOne({ username: entry.username, year });
    if (existing?.status === GreetingSendStatus.SENT) return null;
    const base: Partial<GreetingSendRecord> = {
      ...(existing ? { id: existing.id } : {}),
      username: entry.username,
      year,
      attempts: (existing?.attempts ?? 0) + 1,
      template_id: template?.id ?? null,
      template_title: template?.title ?? null,
      reason: null,
      error: null,
    };
    try {
      const outcome = await this.deliver(entry, year, template);
      await this.sends.save({ ...base, ...outcome });
      return outcome.status;
    } catch (error: unknown) {
      const message = (error as Error).message;
      this.logger.error(`Поздравление ${entry.username}: отправка не удалась: ${message}`);
      await this.sends.save({ ...base, status: GreetingSendStatus.FAILED, error: message, subject: null });
      return GreetingSendStatus.FAILED;
    }
  }

  private async deliver(
    entry: GreetingCalendarRecord,
    year: number,
    template: GreetingTemplateRecord | null
  ): Promise<Pick<GreetingSendRecord, 'status' | 'reason' | 'subject'>> {
    const skip = (reason: GreetingSkipReason) => ({ status: GreetingSendStatus.SKIPPED, reason, subject: null });
    if (!template) return skip(GreetingSkipReason.NO_TEMPLATE);
    const person = await this.people.person(entry.username);
    if (!isEligibleForParticipantMassNotification(person.account)) return skip(GreetingSkipReason.NOT_ACTIVE);
    const provider = person.account.provider_account;
    if (!provider?.subscriber_id || !provider.email) return skip(GreetingSkipReason.NO_RECIPIENT);
    const letter = await this.letters.letter(person, template, ageInYear(entry.birth_year, year));
    const signature = await this.people.signature();
    await this.notifications.notifyUser(entry.username, Workflows.BirthdayGreeting.id, {
      subject: letter.subject,
      bodyHtml: letter.bodyHtml,
      coopShortName: signature.cooperative,
    });
    return { status: GreetingSendStatus.SENT, reason: null, subject: letter.subject };
  }
}
