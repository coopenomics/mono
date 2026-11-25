import { GreetingsTemplatesService } from '~/extensions/greetings/application/services/greetings-templates.service';
import { GreetingTemplateStatus } from '~/extensions/greetings/domain/greetings.enums';
import type { GreetingTemplateRecord } from '~/extensions/greetings/infrastructure/database/greetings.records';

/**
 * Шаблоны поздравлений: правка и смена статуса существующей строки.
 *
 * `TableStore.save` — это INSERT … ON CONFLICT DO UPDATE. Postgres проверяет
 * NOT NULL у вставляемой строки раньше конфликта, поэтому строка из одного
 * ключа и статуса падала на колонке title (Blackbox 24→25.11.2026), а правка
 * черновика — на created_by. Хранилище ниже ведёт себя так же: `save` без
 * обязательных полей отвергается, `update` правит только присланное.
 */

const REQUIRED: Array<keyof GreetingTemplateRecord> = ['title', 'period_start', 'period_end', 'subject', 'body', 'status', 'created_by'];

function memoryTemplates() {
  const rows: GreetingTemplateRecord[] = [];
  let seq = 0;
  const matches = (row: GreetingTemplateRecord, where: Partial<GreetingTemplateRecord>) =>
    Object.entries(where).every(([key, value]) => (row as any)[key] === value);
  return {
    rows,
    async findOne(where: Partial<GreetingTemplateRecord>) {
      return rows.find((row) => matches(row, where)) ?? null;
    },
    async find(where: Partial<GreetingTemplateRecord> = {}) {
      return rows.filter((row) => matches(row, where));
    },
    async save(record: Partial<GreetingTemplateRecord>) {
      const missing = REQUIRED.filter((field) => record[field] === undefined || record[field] === null);
      if (missing.length) throw new Error(`null value in column "${missing[0]}" violates not-null constraint`);
      const existing = record.id ? rows.find((row) => row.id === record.id) : undefined;
      if (existing) return Object.assign(existing, record);
      const row = { ...record, id: `tpl-${++seq}` } as GreetingTemplateRecord;
      rows.push(row);
      return row;
    },
    async update(where: Partial<GreetingTemplateRecord>, patch: Partial<GreetingTemplateRecord>) {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, patch));
      return hit.length;
    },
    async delete(where: Partial<GreetingTemplateRecord>) {
      const before = rows.length;
      rows.splice(0, rows.length, ...rows.filter((row) => !matches(row, where)));
      return before - rows.length;
    },
  };
}

const draft = (title: string) => ({
  title,
  period_start: '2041-01-01',
  period_end: '2041-12-31',
  subject: '{{Обращение}}, с днём рождения!',
  body: '{{Обращение}}, {{Кооператив}} поздравляет вас с {{Летие}}.',
});

describe('GreetingsTemplatesService: существующая строка шаблона', () => {
  // grt.tpl.side.05: смена статуса и правка черновика не теряют обязательных полей.
  it('смена статуса пишет только статус и не трогает остальные поля', async () => {
    const store = memoryTemplates();
    const service = new GreetingsTemplatesService(store as any);
    const created = await service.save(draft('Поздравление'), 'ant');

    const active = await service.setStatus(created.id, GreetingTemplateStatus.ACTIVE);
    expect(active).toMatchObject({ status: GreetingTemplateStatus.ACTIVE, title: 'Поздравление', created_by: 'ant' });
    const back = await service.setStatus(created.id, GreetingTemplateStatus.DRAFT);
    expect(back.status).toBe(GreetingTemplateStatus.DRAFT);
  });

  it('правка черновика сохраняет автора и статус', async () => {
    const store = memoryTemplates();
    const service = new GreetingsTemplatesService(store as any);
    const created = await service.save(draft('Черновик'), 'ant');

    const edited = await service.save({ ...draft('Черновик, вторая редакция'), id: created.id }, 'petr');
    expect(edited).toMatchObject({ id: created.id, title: 'Черновик, вторая редакция', created_by: 'ant', status: GreetingTemplateStatus.DRAFT });
    expect(store.rows).toHaveLength(1);
  });
});
