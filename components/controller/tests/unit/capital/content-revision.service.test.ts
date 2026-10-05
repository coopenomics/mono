import { ContentRevisionService } from '../../../src/extensions/capital/application/services/content-revision.service';
import { ContentEntityType } from '../../../src/extensions/capital/domain/enums/content-entity-type.enum';
import { ContentRevisionOrigin } from '../../../src/extensions/capital/domain/enums/content-revision-origin.enum';
import { ContentConflictError } from '../../../src/extensions/capital/domain/errors/content-conflict.error';

/**
 * Мини-БД в памяти: строка сущности + таблица снимков. Готовые запросы сервиса
 * (блокировка строки, запись текста и номера редакции) отвечает `em`, записи
 * снимков — шлюз таблицы на том же соединении транзакции.
 */
function makeFakeDb(row: { title: string; description: string; content_rev: number }) {
  const revisions: any[] = [];
  const answer = (sql: string, params: any[]): any[] => {
    if (sql.includes('FOR UPDATE')) return [{ ...row, content_format: null }];
    if (sql.startsWith('UPDATE') && sql.includes('SET title')) {
      row.title = params[0];
      row.description = params[1];
      row.content_rev = params[2];
      return [];
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET content_rev')) {
      row.content_rev = params[0];
      return [];
    }
    if (sql.startsWith('SELECT content_rev')) return [{ content_rev: row.content_rev }];
    throw new Error(`unexpected sql: ${sql}`);
  };
  const em: any = {
    executeQuery: jest.fn(async (query: { sql: string; parameters: any[] }) => ({ rows: answer(query.sql, query.parameters) })),
    transaction: () => ({ execute: async (fn: (trx: any) => Promise<any>) => fn(em) }),
  };
  const store = {
    findOne: jest.fn(async (where: any) => revisions.find((r) => r.rev === where.rev) ?? null),
    insert: jest.fn(async (rec: any) => {
      revisions.push({ ...rec });
      return rec;
    }),
    delete: jest.fn(async (where: any) => {
      const i = revisions.findIndex((r) => r.rev === where.rev);
      if (i >= 0) revisions.splice(i, 1);
      return i >= 0 ? 1 : 0;
    }),
  };
  const repository = { kysely: em, on: () => store } as any;
  return { row, revisions, em, service: new ContentRevisionService(repository) };
}

const ISSUE = ContentEntityType.ISSUE;

describe('ContentRevisionService.prepareWrite', () => {
  it('cap.rev.side.05: content_rev=0 → лениво сеется rev=1, запись становится rev=2', async () => {
    const { service, row, revisions } = makeFakeDb({ title: 'Старый', description: 'текст', content_rev: 0 });
    const out = await service.prepareWrite({
      entity_type: ISSUE,
      entity_hash: 'h1',
      author: 'alice',
      origin: ContentRevisionOrigin.WEB,
      base_rev: undefined,
      incoming: { description: 'новый текст' },
    });
    expect(out.content_rev).toBe(2);
    expect(out.changed).toBe(true);
    expect(row.content_rev).toBe(2);
    expect(row.description).toBe('новый текст');
    expect(revisions.map((r) => [r.rev, r.origin])).toEqual([
      [1, ContentRevisionOrigin.BACKFILL],
      [2, ContentRevisionOrigin.WEB],
    ]);
  });

  it('base_rev=0 от клиента, видевшего сущность до первого снимка, — не конфликт, обычная запись rev=2', async () => {
    const { service, row, revisions } = makeFakeDb({ title: 'Новая', description: '', content_rev: 0 });
    const out = await service.prepareWrite({
      entity_type: ISSUE,
      entity_hash: 'h1',
      author: 'alice',
      origin: ContentRevisionOrigin.WEB,
      base_rev: 0,
      incoming: { description: 'первый текст' },
    });
    expect(out.content_rev).toBe(2);
    expect(out.merged).toBe(false);
    expect(row.description).toBe('первый текст');
    expect(revisions).toHaveLength(2);
  });

  it('cap.rev.side.04: присланный текст равен текущему — редакция не создаётся', async () => {
    const { service, row, revisions } = makeFakeDb({ title: 'T', description: 'same', content_rev: 3 });
    const out = await service.prepareWrite({
      entity_type: ISSUE,
      entity_hash: 'h1',
      author: 'alice',
      origin: ContentRevisionOrigin.WEB,
      base_rev: 3,
      incoming: { title: 'T', description: 'same' },
    });
    expect(out.changed).toBe(false);
    expect(out.content_rev).toBe(3);
    expect(row.content_rev).toBe(3);
    expect(revisions).toHaveLength(0);
  });

  it('base_rev отстал, правки в разных местах — слияние, merged=true', async () => {
    const { service, revisions, row } = makeFakeDb({ title: 'T', description: 'a\nb\nc (чужое)', content_rev: 2 });
    revisions.push({ rev: 1, title: 'T', description: 'a\nb\nc' });
    const out = await service.prepareWrite({
      entity_type: ISSUE,
      entity_hash: 'h1',
      author: 'bob',
      origin: ContentRevisionOrigin.CLI,
      base_rev: 1,
      incoming: { title: 'T', description: 'a (моё)\nb\nc' },
    });
    expect(out.merged).toBe(true);
    expect(out.description).toBe('a (моё)\nb\nc (чужое)');
    expect(out.content_rev).toBe(3);
    expect(row.description).toBe('a (моё)\nb\nc (чужое)');
    expect(revisions.find((r) => r.rev === 3)?.merged).toBe(true);
  });

  it('настоящий конфликт — ContentConflictError с обеими версиями, строка не тронута', async () => {
    const { service, revisions, row } = makeFakeDb({ title: 'T', description: 'a\nb (чужое)\nc', content_rev: 2 });
    revisions.push({ rev: 1, title: 'T', description: 'a\nb\nc' });
    await expect(
      service.prepareWrite({
        entity_type: ISSUE,
        entity_hash: 'h1',
        author: 'bob',
        origin: ContentRevisionOrigin.WEB,
        base_rev: 1,
        incoming: { description: 'a\nb (моё)\nc' },
      })
    ).rejects.toBeInstanceOf(ContentConflictError);
    expect(row.content_rev).toBe(2);
    expect(row.description).toBe('a\nb (чужое)\nc');
    expect(revisions).toHaveLength(1);
  });

  it('cap.rev.break.01: rollbackWrite возвращает строку к предыдущей редакции и удаляет снимок', async () => {
    const { service, revisions, row } = makeFakeDb({ title: 'T', description: 'v2', content_rev: 2 });
    revisions.push({ rev: 1, title: 'T', description: 'v1' }, { rev: 2, title: 'T', description: 'v2' });
    await service.rollbackWrite(ISSUE, 'h1', 2);
    expect(row.content_rev).toBe(1);
    expect(row.description).toBe('v1');
    expect(revisions.map((r) => r.rev)).toEqual([1]);
  });
});
