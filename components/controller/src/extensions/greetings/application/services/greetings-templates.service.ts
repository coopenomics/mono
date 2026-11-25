import { Inject, Injectable } from '@nestjs/common';
import { DomainError, TableStore } from '@coopenomics/extension-kit';
import { GREETINGS_TEMPLATE_STORE } from '../../infrastructure/database/greetings-stores';
import type { GreetingTemplateRecord } from '../../infrastructure/database/greetings.records';
import { GreetingTemplateKind, GreetingTemplateStatus } from '../../domain/greetings.enums';
import { findUnknownVariables, findVariablesNotForKind } from '../../domain/greeting-letter';
import { chooseTemplate, isValidPeriod } from '../../domain/template-choice';

/** Поля шаблона, которые пишет председатель. */
export interface GreetingTemplateDraft {
  id?: string | null;
  title: string;
  period_start: string;
  period_end: string;
  subject: string;
  body: string;
  /** Повод; без него — день рождения, как у шаблонов до рассылок. */
  kind?: GreetingTemplateKind | null;
  /** Рассылка повторяется каждый год. */
  repeat_yearly?: boolean | null;
}

/**
 * Шаблоны поздравлений председателя.
 *
 * Черновик сохраняется с любым текстом: председатель пишет его постепенно.
 * Действующий шаблон проверяется строже — его возьмёт рассылка: тема и текст
 * заполнены, неизвестных переменных нет, у рассылки нет возраста, другого
 * действующего поздравления с тем же периодом нет.
 *
 * Рассылка в дату хранит дату в `period_start`; `period_end` равен ей же,
 * поэтому выбор поздравления на дату рассылку не задевает.
 */
@Injectable()
export class GreetingsTemplatesService {
  constructor(@Inject(GREETINGS_TEMPLATE_STORE) private readonly templates: TableStore<GreetingTemplateRecord>) {}

  async list(): Promise<GreetingTemplateRecord[]> {
    return this.templates.find({}, { order: { period_start: 'DESC', period_end: 'ASC', created_at: 'DESC' } });
  }

  async get(id: string): Promise<GreetingTemplateRecord> {
    const template = await this.templates.findOne({ id });
    if (!template) throw DomainError.notFound('GREETINGS_TEMPLATE_NOT_FOUND');
    return template;
  }

  async active(): Promise<GreetingTemplateRecord[]> {
    return this.templates.find({ status: GreetingTemplateStatus.ACTIVE });
  }

  /** Шаблон, который рассылка возьмёт на дату `ГГГГ-ММ-ДД`. */
  async forDate(date: string): Promise<GreetingTemplateRecord | null> {
    return chooseTemplate(await this.active(), date);
  }

  async save(draft: GreetingTemplateDraft, author: string): Promise<GreetingTemplateRecord> {
    const kind = draft.kind ?? GreetingTemplateKind.BIRTHDAY;
    const periodEnd = kind === GreetingTemplateKind.MAILING ? draft.period_start : draft.period_end;
    if (!isValidPeriod(draft.period_start, periodEnd)) throw DomainError.badRequest('GREETINGS_TEMPLATE_PERIOD_INVALID');
    const existing = draft.id ? await this.get(draft.id) : null;
    const fields: Partial<GreetingTemplateRecord> = {
      title: draft.title.trim(),
      period_start: draft.period_start,
      period_end: periodEnd,
      subject: draft.subject,
      body: draft.body,
      kind,
      repeat_yearly: kind === GreetingTemplateKind.MAILING && Boolean(draft.repeat_yearly),
    };
    // Новая дата рассылки — новая отправка: отметка прошлого обхода снимается.
    if (existing && existing.period_start !== draft.period_start) fields.sent_on = null;
    if (!existing) return this.templates.save({ ...fields, created_by: author, status: GreetingTemplateStatus.DRAFT });
    // Правка действующего шаблона проходит те же проверки, что и включение.
    if (existing.status === GreetingTemplateStatus.ACTIVE) await this.assertActivatable({ ...existing, ...fields });
    // Существующая строка правится UPDATE: `save` — это INSERT … ON CONFLICT, а
    // Postgres проверяет NOT NULL у вставляемой строки раньше конфликта, и
    // строка без created_by падала (Blackbox 24→25.11.2026).
    await this.templates.update({ id: existing.id }, fields);
    return this.get(existing.id);
  }

  async setStatus(id: string, status: GreetingTemplateStatus): Promise<GreetingTemplateRecord> {
    const template = await this.get(id);
    if (status === GreetingTemplateStatus.ACTIVE) await this.assertActivatable(template);
    // Только статус — UPDATE, а не `save`: строка из id и status упиралась в
    // NOT NULL колонки title ещё до ON CONFLICT (Blackbox 24→25.11.2026).
    await this.templates.update({ id: template.id }, { status });
    return this.get(template.id);
  }

  /** Удаление шаблона; журнал хранит название шаблона на момент отправки. */
  async remove(id: string): Promise<boolean> {
    await this.get(id);
    return (await this.templates.delete({ id })) > 0;
  }

  private async assertActivatable(
    template: Pick<GreetingTemplateRecord, 'id' | 'subject' | 'body' | 'period_start' | 'period_end' | 'kind'>
  ): Promise<void> {
    if (!template.subject.trim() || !template.body.trim()) throw DomainError.badRequest('GREETINGS_TEMPLATE_EMPTY');
    const text = `${template.subject}\n${template.body}`;
    const unknown = findUnknownVariables(text);
    if (unknown.length) throw DomainError.badRequest('GREETINGS_TEMPLATE_UNKNOWN_VARIABLES', { variables: unknown.join(', ') });
    const kind = template.kind ?? GreetingTemplateKind.BIRTHDAY;
    const birthdayOnly = findVariablesNotForKind(text, kind);
    if (birthdayOnly.length) {
      throw DomainError.badRequest('GREETINGS_TEMPLATE_VARIABLES_BIRTHDAY_ONLY', { variables: birthdayOnly.join(', ') });
    }
    if (kind !== GreetingTemplateKind.BIRTHDAY) return;
    const twin = (await this.active()).find(
      (other) =>
        (other.kind ?? GreetingTemplateKind.BIRTHDAY) === GreetingTemplateKind.BIRTHDAY &&
        other.id !== template.id &&
        other.period_start === template.period_start &&
        other.period_end === template.period_end
    );
    if (twin) throw DomainError.conflict('GREETINGS_TEMPLATE_PERIOD_TAKEN', { title: twin.title });
  }
}
