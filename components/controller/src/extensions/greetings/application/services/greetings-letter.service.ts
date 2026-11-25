import { Inject, Injectable } from '@nestjs/common';
import { DomainError, platformSettings } from '@coopenomics/extension-kit';
import { NOTIFICATION_PORT, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { t } from '../../i18n';
import { GreetingTemplateKind } from '../../domain/greetings.enums';
import { buildGreetingLetter, findUnknownVariables, greetingValues, type GreetingLetter } from '../../domain/greeting-letter';
import { ageInYear, localDate } from '../../domain/birthday';
import { GreetingsPeopleService, type GreetingPerson } from './greetings-people.service';
import { GreetingsCalendarService } from './greetings-calendar.service';

/** Текст шаблона для письма. */
export interface GreetingText {
  subject: string;
  body: string;
}

export interface GreetingPreview extends GreetingLetter {
  username: string;
  displayName: string;
  /** Сколько лет исполняется в ближайший день рождения. */
  age: number | null;
  unknownVariables: string[];
}

/**
 * Письмо пайщику по шаблону. Предпросмотр и рассылка зовут одну функцию,
 * поэтому председатель видит ровно то письмо, которое получит пайщик.
 */
@Injectable()
export class GreetingsLetterService {
  constructor(
    private readonly people: GreetingsPeopleService,
    private readonly calendar: GreetingsCalendarService,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort
  ) {}

  /** Письмо пайщику; `age` — сколько исполняется в год поздравления. */
  async letter(person: GreetingPerson, text: GreetingText, age: number | null): Promise<GreetingLetter> {
    const signature = await this.people.signature();
    return buildGreetingLetter(text, greetingValues(this.people.subject(person, age, signature)));
  }

  /**
   * Предпросмотр несохранённого текста на пайщике. Без пайщика — на
   * ближайшем имениннике: так председатель сразу видит живое письмо.
   */
  async preview(text: GreetingText, username?: string | null, kind?: GreetingTemplateKind | null): Promise<GreetingPreview> {
    const mailing = kind === GreetingTemplateKind.MAILING;
    const today = localDate(new Date(), platformSettings().timezone);
    const entry = username
      ? await this.calendar.find(username)
      : (await this.calendar.upcoming({ month: today.month, day: today.day }, 1))[0] ?? null;
    if (!entry) {
      throw username
        ? DomainError.notFound('GREETINGS_PARTICIPANT_NOT_IN_CALENDAR')
        : DomainError.notFound('GREETINGS_PREVIEW_NO_PARTICIPANT');
    }
    // День рождения в этом году прошёл — ближайший будет в следующем.
    const passed = entry.birth_month < today.month || (entry.birth_month === today.month && entry.birth_day < today.day);
    // В рассылке всем пайщикам возраст не считается — как и при отправке.
    const age = mailing ? null : ageInYear(entry.birth_year, today.year + (passed ? 1 : 0));
    const person = await this.people.person(entry.username);
    const letter = await this.letter(person, text, age);
    return {
      ...letter,
      username: entry.username,
      displayName: await this.people.displayName(entry.username),
      age,
      unknownVariables: findUnknownVariables(`${text.subject}\n${text.body}`),
    };
  }

  /**
   * Пробное письмо председателю: тот же текст, что получит выбранный пайщик,
   * по тому же сценарию уведомления, с пометкой в теме. Повод — момент
   * отправки, поэтому повтор с тем же текстом центр уведомлений не отбросит.
   */
  async sendTest(
    text: GreetingText,
    username: string | null | undefined,
    recipient: string,
    kind?: GreetingTemplateKind | null
  ): Promise<boolean> {
    const preview = await this.preview(text, username, kind);
    const signature = await this.people.signature();
    const workflow = kind === GreetingTemplateKind.MAILING ? Workflows.InformationalMailing : Workflows.BirthdayGreeting;
    await this.notifications.notifyUser(recipient, workflow.id, {
      subject: t('greetings.letter.testSubject', { subject: preview.subject }),
      bodyHtml: preview.bodyHtml,
      coopShortName: signature.cooperative,
      occasion: `test:${new Date().toISOString()}`,
    });
    return true;
  }
}
