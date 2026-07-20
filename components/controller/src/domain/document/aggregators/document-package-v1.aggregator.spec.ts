import { getActions } from '~/utils/getFetch';
import { DocumentPackageV1Aggregator } from './document-package-v1.aggregator';

jest.mock('~/utils/getFetch', () => ({
  getActions: jest.fn(),
}));

const mockedGetActions = getActions as unknown as jest.Mock;

/**
 * Регрессия: программная оферта ЦПП уходит на цепь через wallet::signagree
 * (program_id > 0), а не через soviet::sndagreement. Агрегатор повестки обязан
 * находить такое приложение к заявлению и не терять его (раньше искал только
 * soviet::newagreement и оферта молча выпадала из links).
 */
describe('DocumentPackageV1Aggregator — приложения к заявлению (links)', () => {
  const STATEMENT_HASH = 'AAAA';
  const OFFER_HASH = 'BBBB'; // программная оферта — подписана через wallet::signagree
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

  const aggregator = new DocumentPackageV1Aggregator(
    documentAggregator as any,
    documentPackageUtils as any,
    accountDomainService as any,
    userCertificateService as any
  );

  beforeEach(() => {
    mockedGetActions.mockReset();
    // Маршрутизация по содержимому фильтра: имитируем explorer get-actions.
    mockedGetActions.mockImplementation(async (_path: string, params: any) => {
      const filter = JSON.parse(params.filter);
      const docHash = filter['data.document.doc_hash'];

      // Платформенное соглашение зарегистрировано в реестре совета.
      if (filter.name === 'newagreement' && docHash === PLATFORM_HASH) {
        return {
          results: [
            {
              data: {
                document: {
                  meta_hash: 'META_PLATFORM',
                  meta: JSON.stringify({ title: 'Политика' }),
                  signatures: [{ id: 'platform-sig' }],
                },
              },
            },
          ],
        };
      }

      // Программная оферта подписана через wallet::signagree, soviet::newagreement по ней НЕТ.
      if (filter.name === 'signagree' && docHash === OFFER_HASH) {
        return {
          results: [
            {
              data: {
                document: {
                  meta_hash: 'META_OFFER',
                  meta: JSON.stringify({ title: 'Оферта Генератор' }),
                  signatures: [{ id: 'offer-sig' }],
                },
              },
            },
          ],
        };
      }

      // Всё прочее (newagreement по оферте, newdecision, newact, newlink) — пусто.
      return { results: [] };
    });
  });

  it('включает программную оферту (wallet::signagree) в приложения к заявлению', async () => {
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

  it('ищет soviet::newagreement раньше, чем wallet::signagree', async () => {
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

    const callNames = mockedGetActions.mock.calls.map(([, params]) => JSON.parse(params.filter).name);
    const offerNewagreementIdx = mockedGetActions.mock.calls.findIndex(
      ([, params]) => {
        const f = JSON.parse(params.filter);
        return f.name === 'newagreement' && f['data.document.doc_hash'] === OFFER_HASH;
      }
    );
    const offerSignagreeIdx = mockedGetActions.mock.calls.findIndex(
      ([, params]) => {
        const f = JSON.parse(params.filter);
        return f.name === 'signagree' && f['data.document.doc_hash'] === OFFER_HASH;
      }
    );

    expect(callNames).toContain('newagreement');
    expect(callNames).toContain('signagree');
    // По одному и тому же хэшу soviet проверяется до wallet-фолбэка.
    expect(offerNewagreementIdx).toBeGreaterThanOrEqual(0);
    expect(offerSignagreeIdx).toBeGreaterThan(offerNewagreementIdx);
  });
});
