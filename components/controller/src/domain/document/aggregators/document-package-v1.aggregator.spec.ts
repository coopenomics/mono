import { DocumentPackageV1Aggregator } from './document-package-v1.aggregator';

/**
 * Регрессия: программная оферта ЦПП (program_id > 0) уходит на цепь через
 * wallet::signagree, а не через soviet::sndagreement, и потому НЕ порождает
 * soviet::newagreement. Агрегатор повестки обязан всё равно находить такое
 * приложение к заявлению и не терять его.
 *
 * Носитель подписи ищется не в самом wallet::signagree, а в soviet::newresolved:
 * его централизованно шлёт make_complete_document на каждый вызов — и из
 * sndagreement, и из signagree. Поэтому у программных оферт newagreement нет,
 * а newresolved есть всегда.
 *
 * История действий читается из собственной базы узла (BlockchainActionHistoryService),
 * а не из обозревателя парсера по HTTP — фильтр приходит объектом, а поле внутри
 * полезной нагрузки адресуется путём `document.doc_hash`.
 */
describe('DocumentPackageV1Aggregator — приложения к заявлению (links)', () => {
  const STATEMENT_HASH = 'AAAA';
  const OFFER_HASH = 'BBBB'; // программная оферта — носитель подписи в soviet::newresolved
  const PLATFORM_HASH = 'CCCC'; // платформенное соглашение — soviet::newagreement

  // Документы существуют в реестре документов независимо от пути подписи.
  const documentByHash: Record<string, any> = {
    [STATEMENT_HASH]: { hash: STATEMENT_HASH, meta: { links: [OFFER_HASH, PLATFORM_HASH] } },
    [OFFER_HASH]: { hash: OFFER_HASH, meta: {} },
    [PLATFORM_HASH]: { hash: PLATFORM_HASH, meta: {} },
  };

  const documentPackageUtils = {
    getDocumentByHash: jest.fn(async (hash: string) => documentByHash[String(hash).toUpperCase()] ?? null),
  };

  // Возвращаем маркер с doc_hash и подписями, чтобы проверить источник приложения.
  const documentAggregator = {
    buildDocumentAggregate: jest.fn(async (signedDoc: any) => ({
      doc_hash: signedDoc.doc_hash,
      signatures: signedDoc.signatures,
    })),
  };

  const accountDomainService = {
    getPrivateAccount: jest.fn(async () => ({ username: 'alice' })),
  };

  const userCertificateService = {
    createCertificateFromUserData: jest.fn(() => ({})),
  };

  const findLast = jest.fn();
  const actionHistory = { findLast, find: jest.fn(async () => ({ results: [], page: 1, limit: 10, total: 0 })) };

  const aggregator = new DocumentPackageV1Aggregator(
    documentAggregator as any,
    documentPackageUtils as any,
    accountDomainService as any,
    userCertificateService as any,
    actionHistory as any
  );

  beforeEach(() => {
    findLast.mockReset();
    // Маршрутизация по содержимому фильтра: имитируем историю действий узла.
    findLast.mockImplementation(async (filter: any) => {
      const docHash = filter?.data?.['document.doc_hash'];

      // Платформенное соглашение зарегистрировано в реестре совета.
      if (filter.name === 'newagreement' && docHash === PLATFORM_HASH) {
        return {
          data: {
            document: {
              meta_hash: 'META_PLATFORM',
              meta: JSON.stringify({ title: 'Политика' }),
              signatures: [{ id: 'platform-sig' }],
            },
          },
        };
      }

      // Программная оферта: soviet::newagreement по ней НЕТ, есть только newresolved.
      if (filter.name === 'newresolved' && docHash === OFFER_HASH) {
        return {
          data: {
            document: {
              meta_hash: 'META_OFFER',
              meta: JSON.stringify({ title: 'Оферта Генератор' }),
              signatures: [{ id: 'offer-sig' }],
            },
          },
        };
      }

      // Всё прочее (newagreement по оферте, newdecision) — пусто.
      return null;
    });
  });

  it('включает программную оферту (soviet::newresolved) в приложения к заявлению', async () => {
    const rawAction = {
      data: {
        package: 'PACKAGE1',
        username: 'alice',
        document: {
          hash: STATEMENT_HASH,
          doc_hash: STATEMENT_HASH,
          meta_hash: 'META_STATEMENT',
          version: '1',
          signatures: [{ id: 'statement-sig' }],
        },
      },
    } as any;

    const result = await aggregator.buildDocumentPackageAggregateV1(rawAction);

    const linkHashes = result.links.map((l: any) => l.doc_hash);
    expect(linkHashes).toContain(OFFER_HASH);
    expect(linkHashes).toContain(PLATFORM_HASH);

    const offerLink = result.links.find((l: any) => l.doc_hash === OFFER_HASH) as any;
    expect(offerLink.signatures).toEqual([{ id: 'offer-sig' }]);
  });

  it('ищет soviet::newagreement раньше, чем soviet::newresolved', async () => {
    const rawAction = {
      data: {
        package: 'PACKAGE1',
        username: 'alice',
        document: {
          hash: STATEMENT_HASH,
          doc_hash: STATEMENT_HASH,
          meta_hash: 'META_STATEMENT',
          version: '1',
          signatures: [{ id: 'statement-sig' }],
        },
      },
    } as any;

    await aggregator.buildDocumentPackageAggregateV1(rawAction);

    const callNames = findLast.mock.calls.map(([filter]) => filter.name);
    const offerNewagreementIdx = findLast.mock.calls.findIndex(
      ([filter]) => filter.name === 'newagreement' && filter?.data?.['document.doc_hash'] === OFFER_HASH
    );
    const offerResolvedIdx = findLast.mock.calls.findIndex(
      ([filter]) => filter.name === 'newresolved' && filter?.data?.['document.doc_hash'] === OFFER_HASH
    );

    expect(callNames).toContain('newagreement');
    expect(callNames).toContain('newresolved');
    // По одному и тому же хэшу реестр соглашений проверяется до общего newresolved.
    expect(offerNewagreementIdx).toBeGreaterThanOrEqual(0);
    expect(offerResolvedIdx).toBeGreaterThan(offerNewagreementIdx);
  });
});
