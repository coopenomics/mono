/**
 * Права образования под общим гардом каркаса (`RightsGuard` над
 * `EdubridgeRights`): случаи edu.rights.* в test-registry/edubridge.desktop-gating.yaml.
 *
 * Матрица прав образования стала таблицей прав приложения. Каталог открыт
 * гостю — у таблицы названы роли гостя; членство считается один раз на запрос
 * и кладётся в запрос для `@CurrentEduMember`, в том числе у операций без
 * требования права; код отказа «права нет» — свой, EDUBRIDGE_INSUFFICIENT_RIGHTS.
 * Требование каждой операции тест читает из исходника резолвера.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { EDUBRIDGE_MEMBERSHIP_KEY, EdubridgeRights, edubridgeRightsTable } from '~/extensions/edubridge/application/access/edubridge-rights';
import { edubridgeAccessMatrix } from '~/extensions/edubridge/application/access/edubridge-access-matrix';
import { EdubridgeMembershipService } from '~/extensions/edubridge/application/membership/edubridge-membership.service';
import { EdubridgeConfigHolder } from '~/extensions/edubridge/application/config/edubridge-config.holder';
import { defaultConfig } from '~/extensions/edubridge/types';
import { guardOver, requirementAt, type Caller } from '../rights/core-rights.harness';

configurePlatformSettings({ coopname: 'voskhod' } as any);

const RESOLVERS = join(__dirname, '../../../src/extensions/edubridge/application/resolvers');
const NO_RIGHT = { code: 'EDUBRIDGE_INSUFFICIENT_RIGHTS' };

/** Стенд: факты ролей по имени пайщика; совет и председатель — по роли узла. */
function make(facts: Record<string, { learner?: boolean; teacher?: boolean; admin?: boolean }> = {}) {
  const holder = new EdubridgeConfigHolder({ get: async () => null, isEnabled: async () => true } as any);
  holder.set({ ...defaultConfig, coopAcceptance: { accepted: true, accepted_at: '' } });
  const roleFacts = {
    resolve: async (_coop: string, username: string) => {
      const f = facts[username] ?? {};
      return { isLearner: !!f.learner, hasTeacherOffer: !!f.teacher, isTeacher: !!f.teacher, isAdmin: !!f.admin };
    },
  };
  const roleAssignments = { declare: jest.fn(), attach: jest.fn(), rolesOf: jest.fn(async () => []), holdersOf: jest.fn(async () => []) };
  const rights = new EdubridgeRights({ register: jest.fn() } as any, new EdubridgeMembershipService(roleFacts as any, holder), roleAssignments as any);
  return { rights, pass: guardOver(rights), roleAssignments };
}

const learner: Caller = { username: 'lena', role: 'user', status: 'active' };
const teacher: Caller = { username: 'tim', role: 'user', status: 'active' };
const stranger: Caller = { username: 'ivan', role: 'user', status: 'active' };
const councilMember: Caller = { username: 'petr', role: 'member', status: 'active' };
const chairman: Caller = { username: 'ant', role: 'chairman', status: 'active' };
const FACTS = { lena: { learner: true }, tim: { teacher: true } };
/** Пайщик, которому председатель назначил роль администратора образования. */
const eduAdmin: Caller = { username: 'adm', role: 'user', status: 'active' };
const ADMIN_FACTS = { ...FACTS, adm: { admin: true } };

const req = (file: string, operation: string) => requirementAt(join(RESOLVERS, file), operation);

describe('таблица прав образования', () => {
  it('повторяет матрицу доступа строка за строкой', () => {
    for (const [role, rights] of Object.entries(edubridgeAccessMatrix)) {
      expect(edubridgeRightsTable[role as keyof typeof edubridgeRightsTable]).toEqual([{ when: [], rights }]);
    }
  });

  it('в резолверах образования не осталось собственного гарда и декоратора', () => {
    for (const name of readdirSync(RESOLVERS).filter((f) => f.endsWith('.resolver.ts'))) {
      const src = readFileSync(join(RESOLVERS, name), 'utf8');
      expect({ name, legacy: /EdubridgeAccessGuard|RequireEduAccess/.test(src) }).toEqual({ name, legacy: false });
    }
  });
});

describe('операции образования под общим гардом', () => {
  // edu.rights.happy.01
  it('каталог читает гость и любой вошедший', async () => {
    const { pass } = make(FACTS);
    const catalog = req('edubridge-catalog.resolver.ts', 'edubridgeCatalog');
    await expect(pass(catalog, null)).resolves.toBe(true);
    await expect(pass(catalog, stranger)).resolves.toBe(true);
    await expect(pass(catalog, learner)).resolves.toBe(true);
  });

  // edu.rights.side.01
  it('страницы учащегося открыты учащемуся; постороннему пайщику и гостю — отказ своим кодом', async () => {
    const { pass } = make(FACTS);
    const own = req('edubridge-member.resolver.ts', 'edubridgeMyLearners');
    await expect(pass(own, learner)).resolves.toBe(true);
    await expect(pass(own, stranger)).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(own, null)).rejects.toMatchObject(NO_RIGHT);
  });

  // edu.rights.side.02
  it('назначения преподавателя — преподавателю; все назначения читают совет, администратор и председатель', async () => {
    const { pass } = make(FACTS);
    const mine = req('edubridge-teacher.resolver.ts', 'edubridgeMyAssignments');
    await expect(pass(mine, teacher)).resolves.toBe(true);
    await expect(pass(mine, learner)).rejects.toMatchObject(NO_RIGHT);
    // Член совета читает все назначения — право на все покрывает и «свои».
    await expect(pass(mine, councilMember)).resolves.toBe(true);
    const all = req('edubridge-teacher.resolver.ts', 'edubridgeAssignments');
    await expect(pass(all, councilMember)).resolves.toBe(true);
    await expect(pass(all, chairman)).resolves.toBe(true);
    await expect(pass(all, teacher)).rejects.toMatchObject(NO_RIGHT);
  });

  // edu.rights.side.03
  it('площадки — только председателю; члену совета и администратору отказ', async () => {
    const { pass } = make(ADMIN_FACTS);
    const requirement = req('edubridge-admin.resolver.ts', 'edubridgeConnectors');
    await expect(pass(requirement, chairman)).resolves.toBe(true);
    await expect(pass(requirement, councilMember)).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(requirement, eduAdmin)).rejects.toMatchObject(NO_RIGHT);
  });

  // access.roles.happy.14
  it('член совета курсы читает, но не ведёт; администратор образования ведёт курсы и допуски', async () => {
    const { pass, rights, roleAssignments } = make(ADMIN_FACTS);
    const read = req('edubridge-course.resolver.ts', 'edubridgeCourses');
    const create = req('edubridge-course.resolver.ts', 'edubridgeCreateCourse');
    const assign = req('edubridge-teacher.resolver.ts', 'edubridgeCreateAssignment');
    for (const who of [councilMember, eduAdmin, chairman]) await expect(pass(read, who)).resolves.toBe(true);
    await expect(pass(create, councilMember)).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(assign, councilMember)).rejects.toMatchObject(NO_RIGHT);
    for (const who of [eduAdmin, chairman]) {
      await expect(pass(create, who)).resolves.toBe(true);
      await expect(pass(assign, who)).resolves.toBe(true);
    }
    await expect(pass(read, stranger)).rejects.toMatchObject(NO_RIGHT);
    rights.onModuleInit();
    expect(roleAssignments.declare).toHaveBeenCalledWith('edubridge', [expect.objectContaining({ key: 'edu-admin' })]);
  });

  // access.roles.side.10
  it('ставки, целевой взнос, расходы программы и отклонение взноса — только председателю', async () => {
    const { pass } = make(ADMIN_FACTS);
    const money: [string, string][] = [
      ['edubridge-economy.resolver.ts', 'edubridgeSetTeacherRate'],
      ['edubridge-economy.resolver.ts', 'edubridgeSetEconomySettings'],
      ['edubridge-economy.resolver.ts', 'edubridgeCreateExpense'],
      ['edubridge-teacher.resolver.ts', 'edubridgeSetAssignmentRate'],
      ['edubridge-teacher.resolver.ts', 'edubridgeDeclineContribution'],
    ];
    for (const [file, operation] of money) {
      const requirement = req(file, operation);
      await expect(pass(requirement, chairman)).resolves.toBe(true);
      await expect(pass(requirement, eduAdmin)).rejects.toMatchObject(NO_RIGHT);
      await expect(pass(requirement, councilMember)).rejects.toMatchObject(NO_RIGHT);
    }
  });

  // edu.rights.happy.02
  it('членство лежит в запросе и у операции без требования права', async () => {
    const { rights } = make(FACTS);
    const request: Record<string, unknown> = { headers: {}, user: learner };
    await rights.onRequest(learner, request);
    expect(request[EDUBRIDGE_MEMBERSHIP_KEY]).toMatchObject({ username: 'lena', roles: expect.arrayContaining(['guest', 'learner']) });
    const guest: Record<string, unknown> = { headers: {} };
    await rights.onRequest(null, guest);
    expect(guest[EDUBRIDGE_MEMBERSHIP_KEY]).toMatchObject({ username: null, roles: ['guest'] });
  });
});
