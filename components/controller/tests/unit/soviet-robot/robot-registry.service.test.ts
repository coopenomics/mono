/**
 * Реестр действий автоматизации робота совета: кворум по правилу контракта,
 * фильтрация просроченных делегирований, ключи и подпись протоколов председателем.
 */
import { RobotRegistryService, followCycles, isAutomationExpired, requiredVotes } from '~/extensions/soviet-robot/application/services/robot-registry.service';
import { RobotVoteMode } from '~/extensions/soviet-robot/domain/enums/robot-vote-mode.enum';

const NO_EXPIRY = '1970-01-01T00:00:00';

function member(username: string, position = 'member', is_voting = true) {
  return { username, position, is_voting, position_title: '' } as any;
}

function board(members: any[]) {
  return { id: 0, type: 'soviet', members } as any;
}

function automation(member: string, vote_types: string[], authorize_types: string[] = [], expires_at = NO_EXPIRY, follow_rules: { decision_type: string; follow: string }[] = []) {
  return {
    id: 1,
    coopname: 'voskhod',
    board_id: 0,
    member,
    permission_name: 'robot',
    vote_types,
    follow_rules,
    authorize_types,
    limit: '0.0000 RUB',
    expires_at,
    created_at: NO_EXPIRY,
    updated_at: NO_EXPIRY,
  } as any;
}

describe('RobotRegistryService.buildRegistry', () => {
  const service = new RobotRegistryService({} as any, {} as any, {} as any);
  const council = board([member('ant', 'chairman'), member('petr'), member('anna'), member('mikhail'), member('olga')]);

  it('кворум по правилу контракта: больше половины состава', () => {
    expect(requiredVotes(5)).toBe(3);
    expect(requiredVotes(4)).toBe(3);
    expect(requiredVotes(1)).toBe(1);
  });

  it('считает делегировавших только с ключом и только голосующих', () => {
    const rows = [automation('petr', ['freedecision']), automation('anna', ['freedecision']), automation('mikhail', ['freedecision'])];
    const registry = service.buildRegistry(rows, council, new Set(['petr', 'anna']), 'petr');
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.voters.map((v) => v.member)).toEqual(['petr', 'anna', 'mikhail']);
    expect(free.vote_quorum).toEqual({ delegated_count: 2, follow_groups: [], required_count: 3, total_members: 5, reached: false, reachable: false });
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

  it('режим повтора: группы по ведомым, кворум достижим после их голосов', () => {
    const follow = (m: string, f: string) => automation(m, [], [], NO_EXPIRY, [{ decision_type: 'freedecision', follow: f }]);
    const rows = [automation('petr', ['freedecision']), follow('anna', 'ant'), follow('mikhail', 'ant'), follow('olga', 'petr')];
    const registry = service.buildRegistry(rows, council, new Set(['petr', 'anna', 'mikhail', 'olga']), 'anna');
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.voters.map((v) => [v.member, v.mode, v.follow])).toEqual([
      ['petr', RobotVoteMode.AUTO, null],
      ['anna', RobotVoteMode.FOLLOW, 'ant'],
      ['mikhail', RobotVoteMode.FOLLOW, 'ant'],
      ['olga', RobotVoteMode.FOLLOW, 'petr'],
    ]);
    // Ольга повторяет за Петром, а Пётр голосует «сразу» — её голос робот подаёт
    // следом сам, без людей. Ждём живого голоса только от Иванова.
    expect(free.vote_quorum).toEqual({
      delegated_count: 2,
      follow_groups: [{ follow: 'ant', count: 2 }],
      required_count: 3,
      total_members: 5,
      reached: false,
      reachable: true,
    });
    expect(free.my_mode).toBe(RobotVoteMode.FOLLOW);
    expect(free.my_follow).toBe('ant');
    expect(free.my_vote).toBe(true);
    expect(free.warnings).toEqual([]);
  });

  it('вся цепочка повторов за автоматическим голосом — кворум робот набирает сам', () => {
    const follow = (m: string) => automation(m, [], [], NO_EXPIRY, [{ decision_type: 'freedecision', follow: 'ant' }]);
    const rows = [automation('ant', ['freedecision'], ['freedecision']), follow('petr'), follow('anna'), follow('mikhail'), follow('olga')];
    const registry = service.buildRegistry(rows, council, new Set(['ant', 'petr', 'anna', 'mikhail', 'olga']), 'ant');
    const free = registry.find((r) => r.type === 'freedecision')!;
    // Председатель отдал голос роботу режимом «сразу», четверо повторяют за ним:
    // ждать некого, все пять голосов подаёт робот.
    expect(free.vote_quorum.delegated_count).toBe(5);
    expect(free.vote_quorum.follow_groups).toEqual([]);
    expect(free.vote_quorum.reached).toBe(true);
  });

  it('цепочка повторов длиной в три звена доходит до автоматического голоса', () => {
    const follow = (m: string, f: string) => automation(m, [], [], NO_EXPIRY, [{ decision_type: 'freedecision', follow: f }]);
    const rows = [automation('ant', ['freedecision']), follow('petr', 'ant'), follow('anna', 'petr'), follow('mikhail', 'anna')];
    const registry = service.buildRegistry(rows, council, new Set(['ant', 'petr', 'anna', 'mikhail']), 'ant');
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.vote_quorum.delegated_count).toBe(4);
    expect(free.vote_quorum.reached).toBe(true);
  });

  it('повтор за тем, кто голосует сам, ждёт его живого голоса', () => {
    const follow = (m: string) => automation(m, [], [], NO_EXPIRY, [{ decision_type: 'freedecision', follow: 'ant' }]);
    const rows = [follow('petr'), follow('anna'), follow('mikhail'), follow('olga')];
    const registry = service.buildRegistry(rows, council, new Set(['petr', 'anna', 'mikhail', 'olga']), 'petr');
    const free = registry.find((r) => r.type === 'freedecision')!;
    // Иванов роботу ничего не доверил — четыре голоса придут только после его.
    expect(free.vote_quorum.delegated_count).toBe(0);
    expect(free.vote_quorum.follow_groups).toEqual([{ follow: 'ant', count: 4 }]);
    expect(free.vote_quorum.reached).toBe(false);
    expect(free.vote_quorum.reachable).toBe(true);
  });

  it('повтор без ключа у робота в кворум не идёт', () => {
    const rows = [automation('anna', [], [], NO_EXPIRY, [{ decision_type: 'freedecision', follow: 'ant' }])];
    const registry = service.buildRegistry(rows, council, new Set());
    expect(registry.find((r) => r.type === 'freedecision')!.vote_quorum.follow_groups).toEqual([]);
  });

  it('замкнутый круг и ведомый без права голоса — предупреждения', () => {
    const follow = (m: string, f: string) => automation(m, [], [], NO_EXPIRY, [{ decision_type: 'freedecision', follow: f }]);
    const withSilent = board([member('ant', 'chairman'), member('petr'), member('anna'), member('mikhail'), member('olga', 'member', false)]);
    const rows = [follow('petr', 'anna'), follow('anna', 'petr'), follow('mikhail', 'olga')];
    const registry = service.buildRegistry(rows, withSilent, new Set(['petr', 'anna', 'mikhail']));
    const free = registry.find((r) => r.type === 'freedecision')!;
    expect(free.warnings).toEqual([
      'mikhail повторяет за olga, у которого нет права голоса',
      'petr, anna повторяют друг за другом — никто не проголосует первым',
    ]);
    expect(followCycles(new Map([['a', 'b'], ['b', 'c'], ['c', 'a'], ['d', 'a']]))).toEqual([['a', 'b', 'c']]);
    expect(followCycles(new Map([['a', 'b'], ['b', 'x']]))).toEqual([]);
  });

  it('просроченное делегирование не учитывается', () => {
    const rows = [automation('petr', ['freedecision'], [], '2020-01-01T00:00:00')];
    expect(isAutomationExpired(rows[0])).toBe(true);
    expect(isAutomationExpired(automation('anna', ['freedecision']))).toBe(false);
    const registry = service.buildRegistry(rows, council, new Set(['petr']));
    expect(registry.find((r) => r.type === 'freedecision')!.voters).toEqual([]);
  });

  it('в реестре только решения с шаблоном протокола', () => {
    const registry = service.buildRegistry([], council, new Set());
    expect(registry.every((r) => r.protocol_registry_id > 0)).toBe(true);
    expect(registry.find((r) => r.type === 'freedecision')).toBeDefined();
    // mktissue заведён в контракте, но повестки по нему нет и протокол не описан
    expect(registry.find((r) => r.type === 'mktissue')).toBeUndefined();
  });

  it('решения расширения приходят только тому, у кого расширение установлено', async () => {
    const chain = { getAutomations: async () => [], getSovietBoard: async () => council } as any;
    const keys = { membersWithKeys: async () => new Set<string>() } as any;
    // Стол заказов установлен, Благорост — нет.
    const extensions = { get: async (name: string) => (name === 'market' ? {} : null) } as any;

    const registry = await new RobotRegistryService(chain, keys, extensions).getRegistry('voskhod');

    expect(registry.map((r) => r.type)).toContain('joincoop');
    expect(registry.map((r) => r.type)).toContain('mktwroff');
    expect(registry.map((r) => r.type)).not.toContain('createresult');
  });

  it('без совета кворум недостижим', () => {
    const registry = service.buildRegistry([automation('petr', ['freedecision'])], null, new Set(['petr']));
    expect(registry.find((r) => r.type === 'freedecision')!.vote_quorum.reached).toBe(false);
  });
});
