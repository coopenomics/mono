/**
 * Заявка на допуск, поданная в цепь мимо API и одобренная в том же блоке.
 *
 * Строка приложения в цепи создаётся и закрывается внутри блока, дельты по ней
 * нет, и до 25.09.2026 одобрение не находило допуск: «Приложение … не найдено
 * для одобрения», допуск в базе не появлялся никогда (C28-80). Теперь строка
 * заводится по самому действию заявки, а действия блока идут по порядку.
 */
import { ClearanceManagementInteractor } from '~/extensions/capital/application/use-cases/clearance-management.interactor';
import { AppendixStatus } from '~/extensions/capital/domain/enums/appendix-status.enum';

function build() {
  const rows = new Map<string, any>();
  const appendixRepository = {
    findByAppendixHash: jest.fn(async (hash: string) => rows.get(hash) ?? null),
    save: jest.fn(async (a: any) => {
      rows.set(a.appendix_hash, a);
      return a;
    }),
  };
  const projects = { findByHash: jest.fn(async () => null) };
  const logger = { setContext: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  const interactor = new ClearanceManagementInteractor(
    appendixRepository as any,
    projects as any,
    { emit: jest.fn() } as any,
    logger as any
  );
  return { interactor, appendixRepository, rows, logger };
}

const request = (hash: string) => ({
  block_num: 797,
  data: { coopname: 'voskhod', username: 'ivanov', project_hash: 'PROJ', appendix_hash: hash, document: { hash: 'd' } },
});

describe('допуск, поданный в цепь мимо API', () => {
  it('заявка заводит строку по действию, одобрение в том же блоке её находит и подтверждает', async () => {
    const m = build();
    await m.interactor.handleGetClearance(request('ABC') as any);
    await m.interactor.handleConfirmClearance({ block_num: 797, data: { appendix_hash: 'ABC' } } as any);

    const row = m.rows.get('abc');
    expect(row).toMatchObject({ username: 'ivanov', project_hash: 'proj', coopname: 'voskhod', present: false });
    expect(row.status).toBe(AppendixStatus.CONFIRMED);
    expect(m.logger.warn).not.toHaveBeenCalled();
  });

  it('строка уже есть (подана через API или пришла дельтой) — заявка её не трогает', async () => {
    const m = build();
    const existing = { appendix_hash: 'abc', status: AppendixStatus.CREATED, contribution: 'Опыт' };
    m.rows.set('abc', existing);

    await m.interactor.handleGetClearance(request('ABC') as any);

    expect(m.appendixRepository.save).not.toHaveBeenCalled();
    expect(m.rows.get('abc')).toBe(existing);
  });
});
