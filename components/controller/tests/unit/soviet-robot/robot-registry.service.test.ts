/**
 * Реестр действий автоматизации робота совета: кворум по правилу контракта,
 * фильтрация просроченных делегирований, ключи и подпись протоколов председателем.
 */
import { RobotRegistryService, isAutomationExpired, requiredDelegations, requiredVotes } from '~/extensions/soviet-robot/application/services/robot-registry.service';

const NO_EXPIRY = '1970-01-01T00:00:00';

function member(username: string, position = 'member', is_voting = true) {
  return { username, position, is_voting, position_title: '' } as any;
}

function board(members: any[]) {
  return { id: 0, type: 'soviet', members } as any;
}

function automation(member: string, vote_types: string[], authorize_types: string[] = [], expires_at = NO_EXPIRY) {
  return {
    id: 1,
    coopname: 'voskhod',
    board_id: 0,
    member,
    permission_name: 'robot',
    vote_types,
    authorize_types,
    limit: '0.0000 RUB',
    expires_at,
    created_at: NO_EXPIRY,
    updated_at: NO_EXPIRY,
  } as any;
}

describe('RobotRegistryService.buildRegistry', () => {
  const service = new RobotRegistryService({} as any, {} as any);
  const council = board([member('ant', 'chairman'), member('petr'), member('anna'), member('mikhail'), member('olga')]);

  it('кворум по правилу контракта: больше половины состава', () => {
    expect(requiredVotes(5)).toBe(3);
    expect(requiredVotes(4)).toBe(3);
    expect(requiredVotes(1)).toBe(1);
  });

  it('роботу нужно на одно делегирование меньше порога: первый голос даёт председатель', () => {
    expect(requiredDelegations(5)).toBe(2);
    expect(requiredDelegations(4)).toBe(2);
    expect(requiredDelegations(1)).toBe(0);
  });

  it('считает делегировавших только с ключом и только голосующих', () => {
    const rows = [automation('petr', ['freedecision']), automation('anna', ['freedecision']), automation('mikhail', ['freedecision'])];
    const registry = service.buildRegistry(rows, council, new Set(['petr', 'anna']), 'petr');
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.voters.map((v) => v.member)).toEqual(['petr', 'anna', 'mikhail']);
    expect(free.vote_quorum).toEqual({ delegated_count: 2, required_count: 2, total_members: 5, reached: true });
    expect(free.my_vote).toBe(true);
    expect(free.my_authorize).toBe(false);
  });

  it('достигнутый кворум и делегированный протокол председателя', () => {
    const rows = [
      automation('ant', ['freedecision'], ['freedecision']),
      automation('petr', ['freedecision']),
      automation('anna', ['freedecision']),
    ];
    const registry = service.buildRegistry(rows, council, new Set(['ant', 'petr', 'anna']), 'ant');
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.vote_quorum.reached).toBe(true);
    expect(free.chairman).toEqual({ username: 'ant', delegated: true, has_key: true });
    expect(free.my_authorize).toBe(true);
  });

  it('одного делегирования на совет из пяти не хватает даже с голосом председателя', () => {
    const rows = [automation('petr', ['freedecision'])];
    const registry = service.buildRegistry(rows, council, new Set(['petr']));
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.vote_quorum).toEqual({ delegated_count: 1, required_count: 2, total_members: 5, reached: false });
  });

  it('председатель не попадает в повторяющих: за собой он не повторяет', () => {
    const rows = [automation('ant', ['freedecision'], ['freedecision']), automation('petr', ['freedecision'])];
    const registry = service.buildRegistry(rows, council, new Set(['ant', 'petr']));
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.voters.map((v) => v.member)).toEqual(['petr']);
    expect(free.chairman.delegated).toBe(true);
  });

  it('просроченное делегирование не учитывается', () => {
    const rows = [automation('petr', ['freedecision'], [], '2020-01-01T00:00:00')];
    expect(isAutomationExpired(rows[0])).toBe(true);
    expect(isAutomationExpired(automation('anna', ['freedecision']))).toBe(false);
    const registry = service.buildRegistry(rows, council, new Set(['petr']));
    expect(registry.find((r) => r.type === 'freedecision')!.voters).toEqual([]);
  });

  it('тип без шаблона протокола помечен как необслуживаемый', () => {
    const registry = service.buildRegistry([], council, new Set());
    expect(registry.find((r) => r.type === 'freedecision')!.serviceable).toBe(true);
    expect(registry.find((r) => r.type === 'mktissue')!.serviceable).toBe(false);
  });

  it('без совета кворум недостижим', () => {
    const registry = service.buildRegistry([automation('petr', ['freedecision'])], null, new Set(['petr']));
    expect(registry.find((r) => r.type === 'freedecision')!.vote_quorum.reached).toBe(false);
  });
});
