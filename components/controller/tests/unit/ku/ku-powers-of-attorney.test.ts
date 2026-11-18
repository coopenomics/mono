/**
 * Доверенности кооператива (решение владельца 18.11.2026).
 *
 * - срок доверенности — год со дня выдачи; за тридцать дней до конца узел
 *   напоминает о продлении; после конца срока доверенность истекла;
 * - учёт ведут события цепи: подпись доверенного лица — «на подписи»,
 *   встречная подпись — «действует», отказ — «отклонена»;
 * - реквизиты доверенности председателя участка (номер, протокол совета,
 *   срок) вписывает узел; без решения совета доверенность не выдаётся;
 * - истёкшая доверенность закрывает пайщику работу по участку на узле —
 *   Стол заказов не считает его работником пункта выдачи.
 */
import { DomainError } from '@coopenomics/extension-kit';
import {
  daysLeft,
  documentDateIso,
  isoFromRuDate,
  powerOfAttorneyStatus,
  renewalDue,
  ruDate,
  validUntilIso,
} from '~/extensions/ku/domain/powers-of-attorney/power-of-attorney';
import { KuPowersOfAttorneyService } from '~/extensions/ku/application/services/ku-powers-of-attorney.service';
import { MarketplaceKuChairmanService } from '~/extensions/marketplace/application/services/marketplace-ku-chairman.service';

jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return { ...actual, platformSettings: () => ({ coopname: 'voskhod', frontendUrl: 'https://desk' }) };
});

describe('доверенность: срок и состояние', () => {
  it('срок — год со дня выдачи, последний день — накануне годовщины', () => {
    expect(validUntilIso('2026-11-18', 12)).toBe('2027-11-17');
    expect(validUntilIso('2028-02-29', 12)).toBe('2029-02-28');
  });

  it('встречно подписанная доверенность после конца срока — истёкшая, в последний день — действует', () => {
    expect(powerOfAttorneyStatus({ status: 'active', valid_until: '2027-11-17' }, '2027-11-17')).toBe('active');
    expect(powerOfAttorneyStatus({ status: 'active', valid_until: '2027-11-17' }, '2027-11-18')).toBe('expired');
    expect(powerOfAttorneyStatus({ status: 'pending', valid_until: '2020-01-01' }, '2027-11-18')).toBe('pending');
  });

  it('напоминание о продлении — за тридцать дней до конца срока и позже', () => {
    const row = { status: 'active' as const, valid_until: '2027-11-17', type: 'branch_trustee' as const };
    expect(renewalDue(row, '2027-10-17')).toBe(false);
    expect(renewalDue(row, '2027-10-18')).toBe(true);
    expect(renewalDue({ ...row, status: 'pending' }, '2027-11-10')).toBe(false);
    expect(daysLeft('2027-11-17', '2027-11-17')).toBe(0);
  });

  it('даты в тексте документа — ДД.ММ.ГГГГ', () => {
    expect(ruDate('2027-11-17')).toBe('17.11.2027');
    expect(isoFromRuDate('18.11.2026 13:33')).toBe('2026-11-18');
    expect(isoFromRuDate('мусор')).toBeNull();
  });

  it('дата протокола из меты документа — и в ISO, и «ДД.ММ.ГГГГ», по часовому поясу документа', () => {
    expect(documentDateIso('2026-11-18T15:02:00.907Z', 'Europe/Moscow')).toBe('2026-11-18');
    expect(documentDateIso('2026-11-18T22:30:00.000Z', 'Europe/Moscow')).toBe('2026-11-19');
    expect(documentDateIso('18.11.2026 13:33')).toBe('2026-11-18');
    expect(documentDateIso('мусор')).toBeNull();
  });
});

function makeService(opts: { establishment?: unknown; trustee?: string; holderRows?: unknown[]; liabilityStatuses?: string[] } = {}) {
  const repository = {
    nextNumber: jest.fn(async () => 7),
    insertPending: jest.fn(async () => undefined),
    resolveByDocument: jest.fn(async () => 1),
    resolveBySource: jest.fn(async () => 1),
    findEstablishment: jest.fn(async () => opts.establishment ?? null),
    findForHolder: jest.fn(async () => opts.holderRows ?? []),
    latestActive: jest.fn(async () => []),
    insertLiability: jest.fn(async () => undefined),
    resolveLiability: jest.fn(async () => undefined),
    liabilityStatuses: jest.fn(async () => opts.liabilityStatuses ?? []),
  } as any;
  const branchPort = { getBranch: jest.fn(async () => ({ braname: 'romashka', trustee: opts.trustee ?? 'ivanov', trusted: [] })) } as any;
  const logger = { setContext: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn() } as any;
  const service = new KuPowersOfAttorneyService(repository, branchPort, {} as any, {} as any, logger, {} as any, undefined);
  return { service, repository };
}

const ESTABLISHMENT = {
  braname: 'romashka',
  branch_name: 'РОМАШКА',
  address: 'г. Красногорск',
  // Документы фабрики v2 пишут дату в ISO — так выглядит протокол совета на стенде.
  authorization: { meta: JSON.stringify({ decision_id: 12, created_at: '2026-11-18T10:33:00.000Z', timezone: 'Europe/Moscow' }) },
};

describe('доверенность председателя участка: реквизиты узла', () => {
  it('номер, протокол совета и срок вписывает узел', async () => {
    const { service } = makeService({ establishment: ESTABLISHMENT });
    const requisites = await service.trusteeAuthorityRequisites('voskhod', 'romashka', 'ivanov');
    expect(requisites).toMatchObject({
      poa_number: '7',
      protocol_number: '12',
      protocol_date: '18.11.2026',
      branch_name: 'РОМАШКА',
      branch_address: 'г. Красногорск',
    });
    expect(requisites.valid_until).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('без решения совета об учреждении участка доверенность не выдаётся', async () => {
    const { service } = makeService({ establishment: null });
    await expect(service.trusteeAuthorityRequisites('voskhod', 'romashka', 'ivanov')).rejects.toBeInstanceOf(DomainError);
  });

  it('доверенность подписывает только председатель участка', async () => {
    const { service } = makeService({ establishment: ESTABLISHMENT, trustee: 'petrov' });
    await expect(service.trusteeAuthorityRequisites('voskhod', 'romashka', 'ivanov')).rejects.toBeInstanceOf(DomainError);
  });

  it('доверенность доверенному лицу выдаётся только на основании действующей доверенности председателя участка', async () => {
    const { service } = makeService({ establishment: ESTABLISHMENT, holderRows: [] });
    await expect(service.trustedAuthorityRequisites('voskhod', 'romashka')).rejects.toBeInstanceOf(DomainError);
  });
});

describe('доверенность: учёт по событиям цепи', () => {
  const authority = {
    hash: 'A'.repeat(64),
    meta: JSON.stringify({ poa_number: '7', protocol_number: '12', protocol_date: '18.11.2026', valid_until: '17.11.2027' }),
  };
  const record = (name: string, data: object) =>
    ({ name, block_time: '2026-11-18T10:00:00.000Z', data: { coopname: 'voskhod', ...data } }) as any;

  it('подпись председателя участка записывает доверенность «на подписи» с реквизитами из документа', async () => {
    const { service, repository } = makeService();
    await service.onTrusteeAuthoritySigned(record('signauth', { braname: 'romashka', username: 'ivanov', authority }));
    expect(repository.insertPending).toHaveBeenCalledWith(
      expect.objectContaining({
        number: 7,
        type: 'branch_trustee',
        registry_id: 329,
        holder: 'ivanov',
        protocol_number: '12',
        issued_at: '2026-11-18',
        valid_until: '2027-11-17',
      })
    );
  });

  it('встречная подпись делает доверенность действующей, отказ — отклонённой', async () => {
    const { service, repository } = makeService();
    await service.onTrusteeAuthorityApproved(record('apprauth', { approval_hash: authority.hash, approved_document: {} }));
    expect(repository.resolveByDocument).toHaveBeenCalledWith(authority.hash, 'active', {}, expect.any(Date));
    await service.onTrusteeAuthorityDeclined(record('declauth', { approval_hash: authority.hash }));
    expect(repository.resolveByDocument).toHaveBeenCalledWith(authority.hash, 'declined', null, expect.any(Date));
  });

  it('событие чужого кооператива учёт не меняет', async () => {
    const { service, repository } = makeService();
    await service.onTrusteeAuthoritySigned({ ...record('signauth', {}), data: { coopname: 'other', braname: 'x', username: 'y', authority } });
    expect(repository.insertPending).not.toHaveBeenCalled();
  });
});

describe('договор о полной материальной ответственности: учёт по событиям цепи', () => {
  const liability = { hash: 'B'.repeat(64), meta: '{}' };
  const record = (name: string, data: object) =>
    ({ name, block_time: '2026-11-18T10:00:00.000Z', data: { coopname: 'voskhod', ...data } }) as any;

  it('подпись председателя участка — договор на подписи; встречная подпись — подписан; отказ — отклонён', async () => {
    const { service, repository } = makeService();
    await service.onTrusteeLiabilitySigned(record('signliab', { braname: 'romashka', username: 'ivanov', liability }));
    expect(repository.insertLiability).toHaveBeenCalledWith(expect.objectContaining({ holder: 'ivanov', document_hash: liability.hash }));
    await service.onTrusteeLiabilityApproved(record('apprliab', { approval_hash: liability.hash, approved_document: {} }));
    expect(repository.resolveLiability).toHaveBeenCalledWith(liability.hash, 'approved', {}, expect.any(Date));
    await service.onTrusteeLiabilityDeclined(record('declliab', { approval_hash: liability.hash }));
    expect(repository.resolveLiability).toHaveBeenCalledWith(liability.hash, 'declined', null, expect.any(Date));
  });

  it('подписанный договор бессрочный: действует, пока новый ждёт подписи', async () => {
    expect(await makeService({ liabilityStatuses: ['pending', 'approved'] }).service.trusteeLiabilityStatus('voskhod', 'romashka', 'ivanov')).toBe('approved');
    expect(await makeService({ liabilityStatuses: ['declined'] }).service.trusteeLiabilityStatus('voskhod', 'romashka', 'ivanov')).toBe('declined');
    expect(await makeService().service.trusteeLiabilityStatus('voskhod', 'romashka', 'ivanov')).toBe('none');
  });
});

describe('Стол заказов: истёкшая доверенность закрывает пункт выдачи', () => {
  const branches = [{ braname: 'romashka', trustee: 'ivanov', trusted: ['sidorov'] }];
  const branchPort = { getBranches: jest.fn(async () => branches) } as any;

  it('председатель участка с истёкшей доверенностью — не работник участка', async () => {
    const port = { listLapsedAuthorities: jest.fn(async () => [{ braname: 'romashka', username: 'ivanov', type: 'branch_trustee', valid_until: '2026-01-01' }]) };
    const service = new MarketplaceKuChairmanService(branchPort, port as any);
    expect(await service.isKuChairman('voskhod', 'ivanov')).toBe(false);
    expect(await service.listChairedBranames('voskhod', 'ivanov')).toEqual([]);
    expect(await service.listOperatorsOfBranch('voskhod', 'romashka')).toEqual(['sidorov']);
    // формальный председатель участка остаётся прежним
    expect(await service.getTrusteeOfBranch('voskhod', 'romashka')).toBe('ivanov');
  });

  it('без доверенностей и без расширения участков полномочия по составу участка', async () => {
    const service = new MarketplaceKuChairmanService(branchPort);
    expect(await service.isKuChairman('voskhod', 'ivanov')).toBe(true);
    const failing = { listLapsedAuthorities: jest.fn(async () => Promise.reject(new Error('база недоступна'))) };
    const tolerant = new MarketplaceKuChairmanService(branchPort, failing as any);
    expect(await tolerant.isMemberOfBranch('voskhod', 'romashka', 'sidorov')).toBe(true);
  });
});
