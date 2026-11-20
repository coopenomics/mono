/**
 * Журнал документов (решение владельца 18.11.2026): строка на каждый
 * подписанный документ, пакет — группировка поверх строк.
 *
 * - соглашение, которое заявление перечисляет в meta.links (вступление), реестр
 *   записывает в пакет заявления с ролью «соглашение» при любом порядке событий;
 * - соглашение, подписанное отдельно (действующим пайщиком), остаётся своим пакетом;
 * - решение, акт и связанный документ получают свою строку и не перетирают
 *   строку заявления того же документа;
 * - название строки берётся по типу документа из реестра шаблонов.
 */
import { SignedDocumentIngestionService } from '~/application/signed-documents/services/signed-document-ingestion.service';
import { SignedDocumentRole } from '~/domain/document/enums/signed-document-role.enum';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import { documentTitle } from '~/domain/document/services/document-title';

const STATEMENT_PKG = 'A'.repeat(64);
const AGREEMENT_HASH = 'B'.repeat(64);

function aggregateWith(meta: Record<string, unknown>) {
  return {
    statement: { action: {}, documentAggregate: { document: { meta, signatures: [] }, rawDocument: { meta, full_title: 'Из фабрики', html: '' } } },
    decision: null,
    acts: [],
    links: [],
  };
}

function make(opts: { linkingPackage?: string | null; existing?: { role: SignedDocumentRole; status: SignedDocumentStatus; blockNum: number } } = {}) {
  const repository = {
    getState: jest.fn(async () => opts.existing ?? null),
    findLinkingPackage: jest.fn(async () => opts.linkingPackage ?? null),
    attachLinkedAgreements: jest.fn(async () => 0),
    upsert: jest.fn(async () => undefined),
    findByPackage: jest.fn(async () => []),
  } as any;
  const aggregator = { buildDocumentPackageAggregate: jest.fn(async () => aggregateWith({ registry_id: 1, username: 'ivanov' })) } as any;
  const service = new SignedDocumentIngestionService(repository, aggregator);
  return { service, repository, aggregator };
}

function action(name: string, docHash: string, pkg: string, block = 100) {
  return {
    name,
    block_num: block,
    block_time: '2026-11-18T08:33:00.000Z',
    data: { coopname: 'voskhod', username: 'ivanov', action: 'joincoop', package: pkg, document: { doc_hash: docHash, hash: docHash } },
  } as any;
}

describe('журнал документов: пакет соглашений вступления', () => {
  it('соглашение, которое перечисляет заявление, реестр записывает в пакет заявления', async () => {
    const { service, repository } = make({ linkingPackage: STATEMENT_PKG });
    await service.ingestAction(action('newresolved', AGREEMENT_HASH, AGREEMENT_HASH), SignedDocumentStatus.Resolved);
    const row = repository.upsert.mock.calls[0][0];
    expect(row.packageHash).toBe(STATEMENT_PKG);
    expect(row.role).toBe(SignedDocumentRole.Agreement);
  });

  it('соглашение без заявления (действующий пайщик) остаётся своим пакетом', async () => {
    const { service, repository } = make({ linkingPackage: null });
    await service.ingestAction(action('newresolved', AGREEMENT_HASH, AGREEMENT_HASH), SignedDocumentStatus.Resolved);
    const row = repository.upsert.mock.calls[0][0];
    expect(row.packageHash).toBe(AGREEMENT_HASH);
    expect(row.role).toBe(SignedDocumentRole.Statement);
  });

  it('заявление, записанное после соглашений, переводит их в свой пакет', async () => {
    const { service, repository, aggregator } = make({ linkingPackage: null });
    aggregator.buildDocumentPackageAggregate.mockResolvedValueOnce(aggregateWith({ registry_id: 100, username: 'ivanov', links: [AGREEMENT_HASH] }));
    await service.ingestAction(action('newsubmitted', 'C'.repeat(64), STATEMENT_PKG), SignedDocumentStatus.Submitted);
    expect(repository.upsert.mock.calls[0][0].links).toEqual([AGREEMENT_HASH]);
    expect(repository.attachLinkedAgreements).toHaveBeenCalledWith('voskhod', STATEMENT_PKG, [AGREEMENT_HASH]);
  });

  it('дата подписи — время блока действия', async () => {
    const { service, repository } = make();
    await service.ingestAction(action('newresolved', AGREEMENT_HASH, AGREEMENT_HASH), SignedDocumentStatus.Resolved);
    expect(repository.upsert.mock.calls[0][0].signed_at).toEqual(new Date('2026-11-18T08:33:00.000Z'));
  });
});

describe('журнал документов: документы процесса', () => {
  it('решение совета получает свою строку с ролью «решение»', async () => {
    const { service, repository } = make();
    const result = await service.ingestPart(action('newdecision', 'D'.repeat(64), STATEMENT_PKG), SignedDocumentRole.Decision);
    expect(result).toBe('created');
    const row = repository.upsert.mock.calls[0][0];
    expect(row.role).toBe(SignedDocumentRole.Decision);
    expect(row.packageHash).toBe(STATEMENT_PKG);
    expect(row.document_aggregate.decision).toBeNull();
    expect(row.document_aggregate.acts).toEqual([]);
  });

  it('строку заявления того же документа акт не перетирает', async () => {
    const { service, repository } = make({
      existing: { role: SignedDocumentRole.Statement, status: SignedDocumentStatus.Resolved, blockNum: 50 },
    });
    expect(await service.ingestPart(action('newact', 'E'.repeat(64), STATEMENT_PKG, 200), SignedDocumentRole.Act)).toBe('skipped');
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('повторная запись той же версии ничего не меняет', async () => {
    const { service, repository } = make({
      existing: { role: SignedDocumentRole.Act, status: SignedDocumentStatus.Resolved, blockNum: 100 },
    });
    expect(await service.ingestPart(action('newact', 'E'.repeat(64), STATEMENT_PKG, 100), SignedDocumentRole.Act)).toBe('skipped');
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('без пакета строка документа процесса не пишется', async () => {
    const { service, repository } = make();
    expect(await service.ingestPart(action('newlink', 'F'.repeat(64), ''), SignedDocumentRole.Link)).toBe('skipped');
    expect(repository.upsert).not.toHaveBeenCalled();
  });
});

describe('журнал документов: название по типу документа', () => {
  it('название — текущая редакция шаблона по номеру', () => {
    expect(documentTitle(100, 'Старое название')).toBe('Заявление на вступление в кооператив');
  });

  it('незнакомый номер — запасное название из документа', () => {
    expect(documentTitle(999999, 'Из фабрики')).toBe('Из фабрики');
    expect(documentTitle(null, '')).toBe('');
  });
});
