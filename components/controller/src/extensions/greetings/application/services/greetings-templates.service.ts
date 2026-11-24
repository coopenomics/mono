import { Inject, Injectable } from '@nestjs/common';
import { DomainError, TableStore } from '@coopenomics/extension-kit';
import { GREETINGS_TEMPLATE_STORE } from '../../infrastructure/database/greetings-stores';
import type { GreetingTemplateRecord } from '../../infrastructure/database/greetings.records';
import { GreetingTemplateStatus } from '../../domain/greetings.enums';
import { findUnknownVariables } from '../../domain/greeting-letter';
import { chooseTemplate, isValidPeriod } from '../../domain/template-choice';

/** Поля шаблона, которые пишет председатель. */
export interface GreetingTemplateDraft {
  id?: string | null;
  title: string;
  period_start: string;
  period_end: string;
  subject: string;
  body: string;
}

/**
 * Шаблоны поздравлений председателя.
 *
 * Черновик сохраняется с любым текстом: председатель пишет его постепенно.
 * Действующий шаблон проверяется строже — его возьмёт рассылка: тема и текст
 * заполнены, неизвестных переменных нет, другого действующего шаблона с тем
 * же периодом нет.
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
    if (!isValidPeriod(draft.period_start, draft.period_end)) throw DomainError.badRequest('GREETINGS_TEMPLATE_PERIOD_INVALID');
    const existing = draft.id ? await this.get(draft.id) : null;
    const record: Partial<GreetingTemplateRecord> = {
      ...(existing ? { id: existing.id } : { created_by: author, status: GreetingTemplateStatus.DRAFT }),
      title: draft.title.trim(),
      period_start: draft.period_start,
      period_end: draft.period_end,
      subject: draft.subject,
      body: draft.body,
    };
    // Правка действующего шаблона проходит те же проверки, что и включение.
    if (existing?.status === GreetingTemplateStatus.ACTIVE) await this.assertActivatable({ ...existing, ...record });
    return this.templates.save(record);
  }

  async setStatus(id: string, status: GreetingTemplateStatus): Promise<GreetingTemplateRecord> {
    const template = await this.get(id);
    if (status === GreetingTemplateStatus.ACTIVE) await this.assertActivatable(template);
    return this.templates.save({ id, status });
  }

  /** Удаление шаблона; журнал хранит название шаблона на момент отправки. */
  async remove(id: string): Promise<boolean> {
    await this.get(id);
    return (await this.templates.delete({ id })) > 0;
  }

  private async assertActivatable(template: Pick<GreetingTemplateRecord, 'id' | 'subject' | 'body' | 'period_start' | 'period_end'>): Promise<void> {
    if (!template.subject.trim() || !template.body.trim()) throw DomainError.badRequest('GREETINGS_TEMPLATE_EMPTY');
    const unknown = findUnknownVariables(`${template.subject}\n${template.body}`);
    if (unknown.length) throw DomainError.badRequest('GREETINGS_TEMPLATE_UNKNOWN_VARIABLES', { variables: unknown.join(', ') });
    const twin = (await this.active()).find(
      (other) =>
        other.id !== template.id && other.period_start === template.period_start && other.period_end === template.period_end
    );
    if (twin) throw DomainError.conflict('GREETINGS_TEMPLATE_PERIOD_TAKEN', { title: twin.title });
  }
}
