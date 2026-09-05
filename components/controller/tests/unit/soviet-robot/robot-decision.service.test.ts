/**
 * Конвейер робота решений совета: голоса первой транзакцией, протокол и
 * исполнение второй, идемпотентность и обработка ошибок.
 */
import { PrivateKey, KeyType } from '@wharfkit/antelope';
import { RobotDecisionService } from '~/extensions/soviet-robot/application/services/robot-decision.service';
import { RobotDecisionStage } from '~/extensions/soviet-robot/domain/enums/robot-decision-stage.enum';

const NO_EXPIRY = '1970-01-01T00:00:00';
const LIMITS = { max_attempts: 3, retry_backoff_sec: 5 };

function wif() {
  return PrivateKey.generate(KeyType.K1).toWif();
}

function makeLogger() {
  return { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeBoard() {
  return {
    id: 0,
    type: 'soviet',
    members: ['ant', 'petr', 'anna', 'mikhail', 'olga'].map((username) => ({
      username,
      position: username === 'ant' ? 'chairman' : 'member',
      is_voting: true,
      position_title: '',
    })),
  } as any;
}

function automation(member: string, vote_types: string[], authorize_types: string[] = []) {
  return { member, permission_name: 'robot', vote_types, authorize_types, limit: '0.0000 RUB', expires_at: NO_EXPIRY } as any;
}

function makeDecision(overrides: Record<string, any> = {}) {
  return {
    id: 7,
    coopname: 'voskhod',
    username: 'ant',
    type: 'freedecision',
    hash: 'AB'.repeat(32),
    votes_for: [],
    votes_against: [],
    approved: false,
    authorized: false,
    statement: { meta: JSON.stringify({ registry_id: 599, title: 'Проект', project_id: 'p-1', coopname: 'voskhod', username: 'ant' }) },
    ...overrides,
  } as any;
}

function makeEntry(overrides: Record<string, any> = {}) {
  return {
    id: 'j1',
    coopname: 'voskhod',
    decision_id: 7,
    decision_type: 'freedecision',
    decision_hash: 'AB'.repeat(32),
    username: 'ant',
    stage: RobotDecisionStage.NEW,
    votes: [],
    protocol_hash: null,
    tx_hashes: [],
    last_error: null,
    attempts: 0,
    next_attempt_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as any;
}

function build(opts: { decision: any; automations: any[]; keys: Record<string, string> }) {
  const journal = { save: jest.fn(async (e: any) => e) } as any;
  const documents = {
    generate: jest.fn(async () => ({
      full_title: 'Протокол',
      html: '<p/>',
      hash: 'CD'.repeat(32),
      meta: { title: 'Протокол', registry_id: 600, lang: 'ru', generator: 't', version: '1.0.0', coopname: 'voskhod', username: 'ant', created_at: 'x', block_num: 1, timezone: 'UTC', links: [] },
      binary: '',
    })),
  } as any;
  const chain = {
    getDecision: jest.fn(async () => opts.decision),
    getAutomations: jest.fn(async () => opts.automations),
    getSovietBoard: jest.fn(async () => makeBoard()),
    submitVotes: jest.fn(async () => 'tx-votes'),
    authorizeAndExec: jest.fn(async () => 'tx-exec'),
  } as any;
  const keys = {
    getWif: jest.fn(async (_coop: string, member: string) => (opts.keys[member] ? { wif: opts.keys[member], permission_name: 'robot' } : null)),
  } as any;
  const toChain = { convertSignedDocumentToBlockchainFormat: jest.fn((d: any) => ({ ...d, meta: JSON.stringify(d.meta) })) } as any;
  const service = new RobotDecisionService(journal, documents, chain, keys, toChain, makeLogger());
  return { service, journal, documents, chain, keys };
}

describe('RobotDecisionService.process', () => {
  it('подаёт голоса делегировавших одной транзакцией и переходит в «проголосовано»', async () => {
    const keys = { petr: wif(), anna: wif() };
    const { service, chain } = build({ decision: makeDecision(), automations: [automation('petr', ['freedecision']), automation('anna', ['freedecision']), automation('olga', ['joincoop'])], keys });
    const result = await service.process(makeEntry(), LIMITS);
    expect(chain.submitVotes).toHaveBeenCalledTimes(1);
    const votes = chain.submitVotes.mock.calls[0][1];
    expect(votes.map((v: any) => v.username)).toEqual(['petr', 'anna']);
    expect(votes.every((v: any) => v.permission === 'robot' && v.decision_id === 7)).toBe(true);
    expect(result.stage).toBe(RobotDecisionStage.VOTED);
    expect(result.votes.map((v: any) => v.member)).toEqual(['petr', 'anna']);
    expect(result.tx_hashes).toEqual(['tx-votes']);
  });

  it('повторная обработка не даёт второго голоса: уже проголосовавшие пропускаются', async () => {
    const keys = { petr: wif() };
    const { service, chain } = build({ decision: makeDecision({ votes_for: ['petr'] }), automations: [automation('petr', ['freedecision'])], keys });
    const result = await service.process(makeEntry({ stage: RobotDecisionStage.VOTED }), LIMITS);
    expect(chain.submitVotes).not.toHaveBeenCalled();
    expect(result.stage).toBe(RobotDecisionStage.AWAITING_QUORUM);
  });

  it('член совета без ключа у робота пропускается', async () => {
    const { service, chain } = build({ decision: makeDecision(), automations: [automation('petr', ['freedecision'])], keys: {} });
    const result = await service.process(makeEntry(), LIMITS);
    expect(chain.submitVotes).not.toHaveBeenCalled();
    expect(result.stage).toBe(RobotDecisionStage.AWAITING_QUORUM);
  });

  it('при кворуме без делегирования председателя ждёт его', async () => {
    const { service, chain } = build({ decision: makeDecision({ approved: true, votes_for: ['petr', 'anna', 'mikhail'] }), automations: [automation('petr', ['freedecision'])], keys: { petr: wif() } });
    const result = await service.process(makeEntry({ stage: RobotDecisionStage.VOTED }), LIMITS);
    expect(chain.authorizeAndExec).not.toHaveBeenCalled();
    expect(result.stage).toBe(RobotDecisionStage.AWAITING_CHAIRMAN);
  });

  it('при кворуме собирает протокол по типу решения, подписывает ключом председателя и исполняет', async () => {
    const chairmanWif = wif();
    const { service, chain, documents } = build({
      decision: makeDecision({ approved: true, votes_for: ['petr', 'anna', 'mikhail'] }),
      automations: [automation('ant', ['freedecision'], ['freedecision'])],
      keys: { ant: chairmanWif },
    });
    const result = await service.process(makeEntry({ stage: RobotDecisionStage.VOTED }), LIMITS);
    expect(documents.generate).toHaveBeenCalledTimes(1);
    const data = documents.generate.mock.calls[0][0].data;
    expect(data).toMatchObject({ registry_id: 600, coopname: 'voskhod', username: 'ant', decision_id: 7, project_id: 'p-1' });
    expect(data.title).toBeUndefined();
    expect(chain.authorizeAndExec).toHaveBeenCalledTimes(1);
    const [, chairman, decisionId, document, permission] = chain.authorizeAndExec.mock.calls[0];
    expect(chairman).toBe('ant');
    expect(decisionId).toBe(7);
    expect(permission).toBe('robot');
    expect(document.signatures[0].signer).toBe('ant');
    expect(result.stage).toBe(RobotDecisionStage.EXECUTED);
    expect(result.tx_hashes).toEqual(['tx-exec']);
    expect(result.protocol_hash).toBeTruthy();
  });

  it('решение исчезло с повестки — запись закрывается', async () => {
    const { service } = build({ decision: null, automations: [], keys: {} });
    const result = await service.process(makeEntry({ stage: RobotDecisionStage.AWAITING_QUORUM }), LIMITS);
    expect(result.stage).toBe(RobotDecisionStage.CLOSED);
  });

  it('ошибка цепи не теряется: отсрочка повтора, после исчерпания попыток — застряло', async () => {
    const { service, chain } = build({ decision: makeDecision(), automations: [automation('petr', ['freedecision'])], keys: { petr: wif() } });
    chain.submitVotes.mockRejectedValue(new Error('assertion failure with message: тест'));
    let entry = makeEntry();
    entry = await service.process(entry, LIMITS);
    expect(entry.attempts).toBe(1);
    expect(entry.last_error).toContain('тест');
    expect(entry.next_attempt_at).toBeInstanceOf(Date);
    expect(entry.stage).toBe(RobotDecisionStage.NEW);
    entry = await service.process(entry, LIMITS);
    entry = await service.process(entry, LIMITS);
    expect(entry.attempts).toBe(3);
    expect(entry.stage).toBe(RobotDecisionStage.FAILED);
  });
});

describe('RobotDecisionService.protocolData', () => {
  const service = new RobotDecisionService({} as any, {} as any, {} as any, {} as any, {} as any, makeLogger());

  it('берёт прикладные поля заявления и отбрасывает служебные', () => {
    const data = service.protocolData(600, 'voskhod', makeDecision());
    expect(data).toMatchObject({ registry_id: 600, coopname: 'voskhod', username: 'ant', decision_id: 7, project_id: 'p-1' });
    expect(data.title).toBeUndefined();
    expect(data.receiver).toBe('ant');
  });

  it('выводит число позиций списания и хэш собрания', () => {
    const decision = makeDecision({ statement: { meta: JSON.stringify({ items: [{ a: 1 }, { a: 2 }], total_amount: '10.0000 RUB' }) } });
    const data = service.protocolData(1107, 'voskhod', decision);
    expect(data.items_count).toBe(2);
    expect(data.meet_hash).toBe('AB'.repeat(32));
  });
});
