import { isTrusteesMeet, meetBranches, meetVoters, resolveMeetParticipation } from '~/domain/meet/utils/meet-voters';
import { MeetVotersDomainService } from '~/domain/meet/services/meet-voters-domain.service';
import { MeetInteractor } from '~/application/meet/interactors/meet.interactor';

/**
 * Кто голосует на общем собрании (компонент 76, задача A86-2).
 *
 * Правило ядра повторяет проверки контракта meet: форма собрания закреплена
 * при одобрении советом; на собрании уполномоченных голосует и подтверждает
 * уведомление председатель участка, созданного не позже одобрения, а участок
 * голосует один раз. Собрание без формы (одобрено до её появления) следует
 * флагу кооператива, состав участков датой не ограничен.
 */

const FIXED_AT = '2026-11-24T09:00:00';
const trusteesForm = (voted: string[] = []) => ({
  is_branched: 1,
  branches_count: 3,
  fixed_at: FIXED_AT,
  voted_branches: voted,
});
const membersForm = { is_branched: 0, branches_count: 0, fixed_at: FIXED_AT, voted_branches: [] };

const BRANCHES = [
  { braname: 'north', trustee: 'alice', created_at: '2026-11-01T00:00:00' },
  { braname: 'south', trustee: 'bob', created_at: '2026-11-24T09:00:00' }, // в ту же секунду — входит
  { braname: 'east', trustee: 'carol' }, // создан до появления даты — входит
  { braname: 'west', trustee: 'dave', created_at: '2026-11-24T09:00:01' }, // после одобрения — не входит
];

describe('форма собрания', () => {
  it('закреплённая форма главнее флага кооператива', () => {
    expect(isTrusteesMeet(trusteesForm(), false)).toBe(true);
    expect(isTrusteesMeet(membersForm, true)).toBe(false);
  });

  it('собрание без формы следует флагу кооператива', () => {
    expect(isTrusteesMeet(null, true)).toBe(true);
    expect(isTrusteesMeet(undefined, false)).toBe(false);
  });

  it('логический флаг формы узел отдаёт и числом, и булевым', () => {
    expect(isTrusteesMeet({ ...membersForm, is_branched: true }, false)).toBe(true);
    expect(isTrusteesMeet({ ...membersForm, is_branched: false }, true)).toBe(false);
  });
});

describe('состав собрания уполномоченных', () => {
  it('участки, созданные после одобрения, в собрание не входят', () => {
    expect(meetBranches(trusteesForm(), BRANCHES).map((b) => b.braname)).toEqual(['north', 'south', 'east']);
  });

  it('у собрания без формы в составе все участки', () => {
    expect(meetBranches(null, BRANCHES)).toHaveLength(4);
  });

  it('голосующие — председатели участков собрания; собрание пайщиков — все (null)', () => {
    expect(meetVoters(trusteesForm(), false, BRANCHES)).toEqual(['alice', 'bob', 'carol']);
    expect(meetVoters(membersForm, true, BRANCHES)).toBeNull();
    expect(meetVoters(null, false, BRANCHES)).toBeNull();
    expect(meetVoters(null, true, BRANCHES)).toEqual(['alice', 'bob', 'carol', 'dave']);
  });

  it('председатель нескольких участков (тестнет) попадает в адресаты один раз', () => {
    const twice = [...BRANCHES, { braname: 'extra', trustee: 'alice', created_at: '2026-11-02T00:00:00' }];
    expect(meetVoters(trusteesForm(), false, twice)).toEqual(['alice', 'bob', 'carol']);
  });
});

describe('право пайщика', () => {
  const participation = (username: string, form: any, userBraname?: string) =>
    resolveMeetParticipation({ form, cooperativeIsBranched: false, branches: BRANCHES, username, userBraname });

  it('собрание пайщиков: любой пайщик голосует и подтверждает уведомление', () => {
    expect(participation('zoe', membersForm)).toEqual({
      isTrusteesMeet: false,
      canVote: true,
      canNotify: true,
      branchVoted: false,
      branchTrustee: null,
    });
  });

  it('председатель участка собрания голосует и подтверждает уведомление', () => {
    expect(participation('alice', trusteesForm())).toEqual({
      isTrusteesMeet: true,
      canVote: true,
      canNotify: true,
      branchVoted: false,
      branchTrustee: 'alice',
    });
  });

  it('рядовой пайщик не голосует и видит председателя своего участка', () => {
    expect(participation('zoe', trusteesForm(), 'south')).toEqual({
      isTrusteesMeet: true,
      canVote: false,
      canNotify: false,
      branchVoted: false,
      branchTrustee: 'bob',
    });
  });

  it('рядовой пайщик без участка — председателя нет', () => {
    expect(participation('zoe', trusteesForm()).branchTrustee).toBeNull();
  });

  it('участок проголосовал — новый председатель не голосует, но подтверждает уведомление', () => {
    expect(participation('alice', trusteesForm(['north']))).toEqual({
      isTrusteesMeet: true,
      canVote: false,
      canNotify: true,
      branchVoted: true,
      branchTrustee: 'alice',
    });
  });

  it('рядовой пайщик видит, что его участок уже проголосовал', () => {
    expect(participation('zoe', trusteesForm(['north']), 'north').branchVoted).toBe(true);
  });

  it('председатель участка, созданного после одобрения, не голосует и не подтверждает уведомление', () => {
    const late = participation('dave', trusteesForm());
    expect(late.canVote).toBe(false);
    expect(late.canNotify).toBe(false);
  });
});

function domainService(options: { branches?: any[]; cooperativeIsBranched?: boolean; braname?: string } = {}) {
  const branchPort = { getBranches: jest.fn(async () => options.branches ?? BRANCHES) };
  const accountPort = {
    getCooperatorAccount: jest.fn(async () => ({ is_branched: options.cooperativeIsBranched ? 1 : 0 })),
    getParticipantAccount: jest.fn(async () => (options.braname ? { braname: options.braname } : null)),
  };
  return { service: new MeetVotersDomainService(branchPort as any, accountPort as any), branchPort, accountPort };
}

const row = (form: any) => ({ coopname: 'voskhod', hash: 'h', form }) as any;

describe('состав по данным цепи', () => {
  it('собрание пайщиков с формой цепь не читает', async () => {
    const { service, branchPort, accountPort } = domainService();
    await expect(service.getVoters(row(membersForm))).resolves.toBeNull();
    expect(branchPort.getBranches).not.toHaveBeenCalled();
    expect(accountPort.getCooperatorAccount).not.toHaveBeenCalled();
  });

  it('собрание уполномоченных — председатели участков из цепи', async () => {
    const { service, accountPort } = domainService();
    await expect(service.getVoters(row(trusteesForm()))).resolves.toEqual(['alice', 'bob', 'carol']);
    expect(accountPort.getCooperatorAccount).not.toHaveBeenCalled();
  });

  it('собрание без формы читает флаг кооператива', async () => {
    const { service, accountPort } = domainService({ cooperativeIsBranched: true });
    await expect(service.getVoters(row(undefined))).resolves.toEqual(['alice', 'bob', 'carol', 'dave']);
    expect(accountPort.getCooperatorAccount).toHaveBeenCalledWith('voskhod');
  });

  it('право пайщика берёт его участок из реестра пайщиков', async () => {
    const { service, accountPort } = domainService({ braname: 'east' });
    const result = await service.getParticipation(row(trusteesForm()), 'zoe');
    expect(accountPort.getParticipantAccount).toHaveBeenCalledWith('voskhod', 'zoe');
    expect(result.branchTrustee).toBe('carol');
  });
});

describe('проверка до обращения в цепь', () => {
  function interactor(form: any, username: string) {
    const chain = {
      getMeet: jest.fn(async () => ({ hash: 'h', meet: row(form), questions: [] })),
      vote: jest.fn(async () => undefined),
      notifyOnAnnualGeneralMeet: jest.fn(async () => undefined),
    };
    const repo = { findByHash: jest.fn(async () => null) };
    const { service } = domainService({ braname: 'north' });
    const it = new MeetInteractor({} as any, repo as any, repo as any, chain as any, {} as any, service);
    const vote = () => it.vote({ coopname: 'voskhod', hash: 'h', username } as any);
    const notify = () => it.notifyOnAnnualGeneralMeet({ coopname: 'voskhod', meet_hash: 'h', username } as any);
    return { chain, vote, notify };
  }

  it('рядовой пайщик на собрании уполномоченных — отказ MEET_NOT_TRUSTEE, транзакции нет', async () => {
    const { chain, vote, notify } = interactor(trusteesForm(), 'zoe');
    await expect(vote()).rejects.toMatchObject({ code: 'MEET_NOT_TRUSTEE' });
    await expect(notify()).rejects.toMatchObject({ code: 'MEET_NOT_TRUSTEE' });
    expect(chain.vote).not.toHaveBeenCalled();
    expect(chain.notifyOnAnnualGeneralMeet).not.toHaveBeenCalled();
  });

  it('участок уже проголосовал — отказ MEET_BRANCH_ALREADY_VOTED', async () => {
    const { chain, vote } = interactor(trusteesForm(['north']), 'alice');
    await expect(vote()).rejects.toMatchObject({ code: 'MEET_BRANCH_ALREADY_VOTED' });
    expect(chain.vote).not.toHaveBeenCalled();
  });

  it('председатель участка собрания голосует', async () => {
    const { chain, vote } = interactor(trusteesForm(), 'alice');
    await vote();
    expect(chain.vote).toHaveBeenCalled();
  });

  it('собрание пайщиков — рядовой пайщик голосует', async () => {
    const { chain, vote } = interactor(membersForm, 'zoe');
    await vote();
    expect(chain.vote).toHaveBeenCalled();
  });
});
