import { Inject, Injectable } from '@nestjs/common';
import { TableStore } from '@coopenomics/extension-kit';
import {
  LOGGER_PORT,
  NOTIFICATION_PORT,
  isEligibleForParticipantMassNotification,
  type ILoggerPort,
  type INotificationPort,
} from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { GREETINGS_SEND_STORE, GREETINGS_TEMPLATE_STORE } from '../../infrastructure/database/greetings-stores';
import type { GreetingSendRecord, GreetingTemplateRecord } from '../../infrastructure/database/greetings.records';
import { GreetingSendStatus, GreetingTemplateKind } from '../../domain/greetings.enums';
import { buildGreetingLetter, greetingValues } from '../../domain/greeting-letter';
import { formatDate, type CalendarDate } from '../../domain/birthday';
import { mailingsDue } from '../../domain/template-choice';
import { GreetingsPeopleService, type GreetingPerson } from './greetings-people.service';

/** Страница обхода пайщиков: на каждого ядро читает и цепь. */
const PAGE_SIZE = 25;

export interface MailingRunResult {
  templateId: string;
  sent: number;
  failed: number;
}

/**
 * Информационная рассылка в дату: письмо каждому действующему пайщику с
 * почтой, в том числе организациям — к ним обращение идёт по названию.
 *
 * Журнал держит одну строку на шаблон, пайщика и дату. Рассылка, обошедшая
 * всех без ошибок, ставит шаблону отметку дня, и следующие запуски в этот
 * день пайщиков не перебирают. Ошибка оставляет отметку пустой: следующий
 * запуск повторит только неотправленные письма.
 */
@Injectable()
export class GreetingsMailingService {
  constructor(
    @Inject(GREETINGS_TEMPLATE_STORE) private readonly templates: TableStore<GreetingTemplateRecord>,
    @Inject(GREETINGS_SEND_STORE) private readonly sends: TableStore<GreetingSendRecord>,
    private readonly people: GreetingsPeopleService,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(GreetingsMailingService.name);
  }

  async run(today: CalendarDate, active: readonly GreetingTemplateRecord[]): Promise<MailingRunResult[]> {
    const date = formatDate(today);
    const results: MailingRunResult[] = [];
    for (const template of mailingsDue(active, today)) {
      if (template.sent_on === date) continue;
      const result = await this.send(template, today);
      if (result.failed === 0) await this.templates.update({ id: template.id }, { sent_on: date });
      this.logger.info(`Рассылка «${template.title}» ${date}: отправлено ${result.sent}, ошибок ${result.failed}`, result);
      results.push(result);
    }
    return results;
  }

  private async send(template: GreetingTemplateRecord, today: CalendarDate): Promise<MailingRunResult> {
    const result: MailingRunResult = { templateId: template.id, sent: 0, failed: 0 };
    const signature = await this.people.signature();
    for (let page = 1; ; page += 1) {
      const { people, totalPages } = await this.people.page(page, PAGE_SIZE);
      for (const person of people) {
        const status = await this.deliver(template, person, today, signature);
        if (status === GreetingSendStatus.SENT) result.sent += 1;
        if (status === GreetingSendStatus.FAILED) result.failed += 1;
      }
      if (page >= totalPages || people.length === 0) return result;
    }
  }

  /** Письмо одному пайщику; `null` — не адресат рассылки или уже получил письмо. */
  private async deliver(
    template: GreetingTemplateRecord,
    person: GreetingPerson,
    today: CalendarDate,
    signature: { cooperative: string; chairman: string }
  ): Promise<GreetingSendStatus | null> {
    const provider = person.account.provider_account;
    if (!isEligibleForParticipantMassNotification(person.account) || !provider?.subscriber_id || !provider.email) return null;
    const date = formatDate(today);
    const key = { kind: GreetingTemplateKind.MAILING, template_id: template.id, username: person.username, occasion_date: date };
    const existing = await this.sends.findOne(key);
    if (existing?.status === GreetingSendStatus.SENT) return null;
    const base: Partial<GreetingSendRecord> = {
      ...(existing ? { id: existing.id } : {}),
      ...key,
      year: today.year,
      template_title: template.title,
      attempts: (existing?.attempts ?? 0) + 1,
      reason: null,
    };
    try {
      const displayName = await this.people.displayName(person.username);
      const letter = buildGreetingLetter(template, greetingValues({ ...this.people.subject(person, null, signature), displayName }));
      const queued = await this.notifications.notifyUser(person.username, Workflows.InformationalMailing.id, {
        subject: letter.subject,
        bodyHtml: letter.bodyHtml,
        coopShortName: signature.cooperative,
        occasion: `mailing:${template.id}:${date}`,
      });
      await this.sends.save({
        ...base,
        status: GreetingSendStatus.SENT,
        subject: letter.subject,
        error: null,
        outbox_ids: queued?.outboxIds ?? [],
      });
      return GreetingSendStatus.SENT;
    } catch (error: unknown) {
      const message = (error as Error).message;
      this.logger.error(`Рассылка «${template.title}», пайщик ${person.username}: ${message}`);
      await this.sends.save({ ...base, status: GreetingSendStatus.FAILED, subject: null, error: message });
      return GreetingSendStatus.FAILED;
    }
  }
}
