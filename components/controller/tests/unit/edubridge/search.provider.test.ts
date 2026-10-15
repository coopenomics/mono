/** Образование в едином поиске: ученики и преподаватели, находки — только по праву на страницу. */
import { EdubridgeSearchProvider } from '~/extensions/edubridge/application/search/edubridge-search.provider';

function make(roles: string[]) {
  const hooks: any[] = [];
  const registry = { register: jest.fn((h: any) => hooks.push(h)) } as any;
  const membership = { resolve: jest.fn(async () => ({ roles })) } as any;
  const admin = { members: jest.fn(async () => [{ username: 'ant', display_name: 'Муравьёв Алексей' }]) } as any;
  const teachers = {
    listTeachers: jest.fn(async () => [
      { username: 'teach', display_name: 'Петрова Анна' },
      { username: 'other', display_name: 'Сидоров Пётр' },
    ]),
  } as any;
  const learners = { searchByName: jest.fn(async () => [{ id: 'L1', display_name: 'Муравьёв Петя', member_username: 'ant' }]) } as any;
  const names = { displayNames: jest.fn(async () => new Map([['ant', 'Муравьёв Алексей']])) } as any;
  const provider = new EdubridgeSearchProvider(registry, membership, admin, teachers, learners, names);
  provider.onModuleInit();
  const group = (key: string) => hooks.find((h) => h.key === key);
  return { group, admin, learners, membership };
}

const ctx = { coopname: 'voskhod', username: 'boss', userRole: 'chairman', userStatus: 'active' } as any;

describe('EdubridgeSearchProvider', () => {
  it('регистрирует две группы: ученики и преподаватели', () => {
    const { group } = make(['owner']);
    expect(group('edubridge-members')).toMatchObject({ title: 'Ученики', extensionName: 'edubridge' });
    expect(group('edubridge-teachers')).toMatchObject({ title: 'Преподаватели' });
  });

  it('ученики: пайщик и его обучающийся ведут в карточку пайщика на странице «Ученики»', async () => {
    const { group, admin, learners } = make(['owner']);
    const hits = await group('edubridge-members').search('Мурав', ctx, 5);
    expect(admin.members).toHaveBeenCalledWith('voskhod', 'Мурав');
    expect(learners.searchByName).toHaveBeenCalledWith('voskhod', 'Мурав', 5);
    const card = { name: 'edubridge-admin-registry', params: { coopname: 'voskhod' }, query: { member: 'ant' } };
    expect(hits).toEqual([
      expect.objectContaining({ key: 'member:ant', title: 'Муравьёв Алексей', subtitle: 'ant', route: card }),
      expect.objectContaining({ key: 'learner:L1', title: 'Муравьёв Петя', subtitle: 'обучающийся · Муравьёв Алексей', route: card }),
    ]);
  });

  it('преподаватели: отбор по ФИО и учётному имени, находка ведёт на страницу преподавателя', async () => {
    const { group } = make(['owner']);
    const hits = await group('edubridge-teachers').search('петрова', ctx, 5);
    expect(hits).toEqual([expect.objectContaining({ key: 'teach', route: { name: 'edubridge-admin-teacher', params: { coopname: 'voskhod', username: 'teach' } } })]);
    expect(await group('edubridge-teachers').search('other', ctx, 5)).toHaveLength(1);
  });

  it('без права на страницу группа пуста и данные не читаются; число находок ограничено', async () => {
    const closed = make(['learner']);
    expect(await closed.group('edubridge-members').search('Мурав', ctx, 5)).toEqual([]);
    expect(await closed.group('edubridge-teachers').search('Петрова', ctx, 5)).toEqual([]);
    expect(closed.admin.members).not.toHaveBeenCalled();
    const open = make(['owner']);
    expect(await open.group('edubridge-members').search('Мурав', ctx, 1)).toHaveLength(1);
  });
});
