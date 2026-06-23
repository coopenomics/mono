/**
 * Unit-тесты KuService (расширение «Кооперативный участок»).
 *
 * Фокус — проверки прав перед отправкой действий в контракт branch
 * (контракт авторизует кооператив целиком, поэтому проверка конкретного
 * пайщика — обязанность backend) и маппинг проекций в DTO:
 * завершённые процессы (present=false после erase) получают статус completed.
 */

import { KuService } from '~/extensions/ku/application/services/ku.service';

const COOP = 'voskhod';
const HASH = 'abc123';

function makeUser(username: string) {
  return { username, role: 'user' } as any;
}

function makePorts() {
  const transactResult = { resolved: {}, response: { transaction_id: 'tx1' } };
  const kuPort = {
    createDecision: jest.fn(async () => transactResult),
    joinDecision: jest.fn(async () => transactResult),
    startDecision: jest.fn(async () => transactResult),
    voteOnDecision: jest.fn(async () => transactResult),
    closeDecision: jest.fn(async () => transactResult),
    execDecision: jest.fn(async () => transactResult),
    cancelDecision: jest.fn(async () => transactResult),
    requestTrusted: jest.fn(async () => transactResult),
    approveTrusted: jest.fn(async () => transactResult),
    declineTrusted: jest.fn(async () => transactResult),
  } as any;

  const branchPort = {
    getBranch: jest.fn(async () => ({ braname: 'romashka', trustee: 'trustee1', trusted: [] })),
  } as any;

  return { kuPort, branchPort };
}

function makeDecision(overrides: Record<string, any> = {}) {
  return {
    _id: 'uuid-1',
    hash: HASH,
    coopname: COOP,
    id: 1,
    type: 'createbranch',
    initiator: 'initiator1',
    chairman: 'chairman1',
    status: 'voting',
    present: true,
    participants: ['initiator1', 'chairman1', 'voter1'],
    block_num: 100,
    ...overrides,
  } as any;
}

function makeRepos(decision: any = makeDecision(), trustRequest: any = null) {
  const decisionRepository = {
    findByHash: jest.fn(async () => decision),
    upsertPrivateData: jest.fn(async () => undefined),
    findAllPaginated: jest.fn(async () => ({
      items: decision ? [decision] : [],
      totalCount: decision ? 1 : 0,
      totalPages: 1,
      currentPage: 1,
    })),
  } as any;

  const questionRepository = {
    findByDecisionId: jest.fn(async () => []),
  } as any;

  const trustRequestRepository = {
    findByHash: jest.fn(async () => trustRequest),
    findAllPaginated: jest.fn(async () => ({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 })),
  } as any;

  return { decisionRepository, questionRepository, trustRequestRepository };
}

function makeDocumentService() {
  return {
    generateDocument: jest.fn(async ({ data }: any) => ({ hash: 'doc', meta: data })),
  } as any;
}

function makeAccountPort() {
  return {
    getAccount: jest.fn(async (username: string) => ({ provider_account: { email: `${username}@x`, subscriber_id: 's' } })),
    getDisplayName: jest.fn(async (username: string) => `ФИО ${username}`),
  } as any;
}

function makeService(opts: { decision?: any; trustRequest?: any } = {}) {
  const { kuPort, branchPort } = makePorts();
  const repos = makeRepos(opts.decision === undefined ? makeDecision() : opts.decision, opts.trustRequest ?? null);
  const documentService = makeDocumentService();
  const accountPort = makeAccountPort();
  const documentAggregator = { buildDocumentAggregate: jest.fn(async () => null) } as any;
  const service = new KuService(
    kuPort,
    branchPort,
    repos.decisionRepository,
    repos.questionRepository,
    repos.trustRequestRepository,
    accountPort,
    documentService,
    documentAggregator
  );
  return { service, kuPort, branchPort, repos, documentService, accountPort, documentAggregator };
}

describe('KuService — проверки прав', () => {
  it('createDecision проходит только от имени инициатора', async () => {
    const { service, kuPort } = makeService();
    const data = {
      coopname: COOP,
      hash: HASH,
      type: 'free',
      initiator: 'alice',
      braname: '',
      agenda: [],
      proposal: {},
      meet_place: 'Москва, ул. Мира, 1',
      meet_at: '2026-06-12T10:00:00.000Z',
    } as any;

    await expect(service.createDecision(data, makeUser('bob'))).rejects.toThrow();
    expect(kuPort.createDecision).not.toHaveBeenCalled();

    await service.createDecision(data, makeUser('alice'));
    expect(kuPort.createDecision).toHaveBeenCalledTimes(1);
  });

  it('joinDecision и voteOnDecision требуют совпадения username с текущим пользователем', async () => {
    const { service, kuPort } = makeService();
    const join = { coopname: COOP, hash: HASH, username: 'alice' } as any;
    const vote = { coopname: COOP, hash: HASH, username: 'alice', ballot: {}, votes: [] } as any;

    await expect(service.joinDecision(join, makeUser('mallory'))).rejects.toThrow();
    await expect(service.voteOnDecision(vote, makeUser('mallory'))).rejects.toThrow();
    expect(kuPort.joinDecision).not.toHaveBeenCalled();
    expect(kuPort.voteOnDecision).not.toHaveBeenCalled();

    await service.joinDecision(join, makeUser('alice'));
    await service.voteOnDecision(vote, makeUser('alice'));
    expect(kuPort.joinDecision).toHaveBeenCalledTimes(1);
    expect(kuPort.voteOnDecision).toHaveBeenCalledTimes(1);
  });

  it('cancelDecision доступна только организатору собрания', async () => {
    const { service, kuPort } = makeService();
    const cancel = { coopname: COOP, hash: HASH, reason: 'передумали' } as any;

    await expect(service.cancelDecision(cancel, makeUser('chairman1'))).rejects.toThrow();

    await service.cancelDecision(cancel, makeUser('initiator1'));
    expect(kuPort.cancelDecision).toHaveBeenCalledTimes(1);
  });

  it('startDecision доступна только организатору; председатель — из участников; для учреждения нужно наименование', async () => {
    const { service, kuPort, repos } = makeService();
    const start = {
      coopname: COOP,
      hash: HASH,
      chairman: 'chairman1',
      address: 'адрес',
      branch_name: 'РОМАШКА',
      branch_email: 'romashka@example.ru',
      branch_phone: '+79000000000',
    } as any;

    await expect(service.startDecision(start, makeUser('chairman1'))).rejects.toThrow();
    await expect(
      service.startDecision({ ...start, chairman: 'stranger' }, makeUser('initiator1'))
    ).rejects.toThrow('участником собрания');
    await expect(
      service.startDecision({ ...start, branch_name: '' }, makeUser('initiator1'))
    ).rejects.toThrow('наименование');
    await expect(
      service.startDecision({ ...start, branch_email: '' }, makeUser('initiator1'))
    ).rejects.toThrow('email и телефон');

    await service.startDecision(start, makeUser('initiator1'));
    expect(kuPort.startDecision).toHaveBeenCalledTimes(1);
    // наименование и контакты участка ушли в приватные данные БД, не в блокчейн
    expect(repos.decisionRepository.upsertPrivateData).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: HASH,
        branch_name: 'РОМАШКА',
        branch_email: 'romashka@example.ru',
        branch_phone: '+79000000000',
      })
    );
  });

  it('closeDecision доступна только организатору (председателю собрания)', async () => {
    const { service, kuPort } = makeService();
    const close = { coopname: COOP, hash: HASH, protocol: {} } as any;

    await expect(service.closeDecision(close, makeUser('chairman1'))).rejects.toThrow();

    await service.closeDecision(close, makeUser('initiator1'));
    expect(kuPort.closeDecision).toHaveBeenCalledTimes(1);
  });

  it('execDecision (направление в совет + договор) доступна только избранному председателю участка', async () => {
    const { service, kuPort } = makeService();
    // заявление в совет и договор о материальной ответственности подписывает
    // избранный собранием председатель участка, а не организатор собрания
    const exec = { coopname: COOP, hash: HASH, petition: {}, liability: {} } as any;

    await expect(service.execDecision(exec, makeUser('initiator1'))).rejects.toThrow();

    await service.execDecision(exec, makeUser('chairman1'));
    expect(kuPort.execDecision).toHaveBeenCalledTimes(1);
  });

  it('approveTrusted/declineTrusted доступны только председателю участка (trustee)', async () => {
    const trustRequest = { hash: HASH, coopname: COOP, braname: 'romashka', username: 'applicant1' };
    const { service, kuPort, branchPort } = makeService({ trustRequest });
    const approve = { coopname: COOP, hash: HASH, countersigned: {} } as any;
    const decline = { coopname: COOP, hash: HASH, reason: 'нет' } as any;

    await expect(service.approveTrusted(approve, makeUser('applicant1'))).rejects.toThrow();
    await expect(service.declineTrusted(decline, makeUser('applicant1'))).rejects.toThrow();
    expect(kuPort.approveTrusted).not.toHaveBeenCalled();

    await service.approveTrusted(approve, makeUser('trustee1'));
    await service.declineTrusted(decline, makeUser('trustee1'));
    expect(branchPort.getBranch).toHaveBeenCalledWith(COOP, 'romashka');
    expect(kuPort.approveTrusted).toHaveBeenCalledTimes(1);
    expect(kuPort.declineTrusted).toHaveBeenCalledTimes(1);
  });

  it('операции над несуществующим решением отклоняются с понятной ошибкой', async () => {
    const { service } = makeService({ decision: null });
    const start = { coopname: COOP, hash: 'missing', chairman: 'x', address: '', branch_name: '' } as any;

    await expect(service.startDecision(start, makeUser('anyone'))).rejects.toThrow('не найдено');
  });
});

describe('KuService — маппинг DTO', () => {
  it('решение со стёртой записью в блокчейне получает статус completed', async () => {
    const { service } = makeService({ decision: makeDecision({ present: false, status: 'onapproval' }) });

    const dto = await service.getDecision(HASH);

    expect(dto.present).toBe(false);
    expect(dto.status).toBe('completed');
  });

  it('живое решение сохраняет статус контракта', async () => {
    const { service } = makeService();

    const dto = await service.getDecision(HASH);

    expect(dto.present).toBe(true);
    expect(dto.status).toBe('voting');
    expect(dto.hash).toBe(HASH);
    // участники обогащены отображаемыми именами для выбора председателя по ФИО
    expect(dto.participants_info).toEqual(
      expect.arrayContaining([{ username: 'chairman1', display_name: 'ФИО chairman1' }])
    );
  });

  it('getDecision подтягивает вопросы повестки по decision_id', async () => {
    const { service, repos } = makeService();

    await service.getDecision(HASH);

    expect(repos.questionRepository.findByDecisionId).toHaveBeenCalledWith(COOP, 1);
  });
});

describe('KuService — генерация документов', () => {
  it('generateBranchMeetingProposal проставляет registry_id 320', async () => {
    const { service, documentService } = makeService();

    await service.generateBranchMeetingProposal({ coopname: COOP, username: 'alice' } as any);

    const { data } = documentService.generateDocument.mock.calls[0][0];
    expect(data.registry_id).toBe(320);
  });

  it('generateBranchTrustedLiabilityAgreement проставляет registry_id 327', async () => {
    const { service, documentService } = makeService();

    await service.generateBranchTrustedLiabilityAgreement({ coopname: COOP, username: 'alice' } as any);

    const { data } = documentService.generateDocument.mock.calls[0][0];
    expect(data.registry_id).toBe(327);
  });

  it('generateBranchTrusteeLiabilityAgreement проставляет registry_id 328', async () => {
    const { service, documentService } = makeService();

    await service.generateBranchTrusteeLiabilityAgreement({ coopname: COOP, username: 'alice' } as any);

    const { data } = documentService.generateDocument.mock.calls[0][0];
    expect(data.registry_id).toBe(328);
  });

  it('generateBranchTrusteePowerOfAttorney проставляет registry_id 329', async () => {
    const { service, documentService } = makeService();

    await service.generateBranchTrusteePowerOfAttorney({ coopname: COOP, username: 'alice' } as any);

    const { data } = documentService.generateDocument.mock.calls[0][0];
    expect(data.registry_id).toBe(329);
  });

  it('generateBranchTrustedPowerOfAttorney проставляет registry_id 330', async () => {
    const { service, documentService } = makeService();

    await service.generateBranchTrustedPowerOfAttorney({ coopname: COOP, username: 'alice' } as any);

    const { data } = documentService.generateDocument.mock.calls[0][0];
    expect(data.registry_id).toBe(330);
  });
});
