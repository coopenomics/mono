/**
 * Права ядра по таблице прав: глава совета (C28-87, случаи core.rights.* в
 * test-registry/core.council-rights.yaml).
 *
 * Операции собраний, решений, повестки и шаблонов документов стоят под общим
 * гардом каркаса расширений (`RightsGuard`) над описанием прав ядра
 * (`CoreRights`). Обход «сам себе» прежнего гарда ролей заменён явным правом с
 * охватом «своё»: имя в запросе сверяется с вошедшим. Требование каждой
 * операции тест читает из исходника резолвера.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desktopGrantsOf } from '@coopenomics/extension-kit';
import { coreRolesOf } from '~/application/rights/core-rights';
import {
  APPLICATION,
  NO_RIGHT,
  OWN,
  candidate,
  chairman,
  councilMember,
  makeGuard,
  participant,
  requirementOf,
  type Caller,
} from './core-rights.harness';

const FILES = {
  ledger2: 'ledger2/resolvers/ledger2.resolver.ts',
  meet: 'meet/resolvers/meet.resolver.ts',
  freeDecision: 'free-decision/resolvers/free-decision.resolver.ts',
  decision: 'decision/resolvers/decision.resolver.ts',
  agenda: 'agenda/resolvers/agenda.resolver.ts',
  templates: 'document-approval/resolvers/document-approval.resolver.ts',
  document: 'document/resolvers/document.resolver.ts',
  gateway: 'gateway/resolvers/gateway.resolver.ts',
  paymentFiles: 'gateway/resolvers/payment-files.resolver.ts',
  accessRoles: 'access-roles/access-roles.resolver.ts',
};

describe('роли ядра', () => {
  it('каждый вошедший — учётная запись; принятый — пайщик; совет и председатель — по роли узла', () => {
    expect(coreRolesOf(candidate)).toEqual(['account']);
    expect(coreRolesOf(participant)).toEqual(['account', 'participant']);
    expect(coreRolesOf(councilMember)).toEqual(['account', 'participant', 'council']);
    expect(coreRolesOf(chairman)).toEqual(['account', 'participant', 'council', 'chairman']);
    // Совет проходит по роли в любом статусе учётной записи.
    expect(coreRolesOf({ role: 'member', status: 'registered' })).toEqual(['account', 'council']);
  });
});

describe('операции совета', () => {
  const COUNCIL: [string, string][] = [
    [FILES.meet, 'createAnnualGeneralMeet'],
    [FILES.meet, 'generateSovietDecisionOnAnnualMeetDocument'],
    [FILES.meet, 'generateAnnualGeneralMeetAgendaDocument'],
    [FILES.freeDecision, 'generateProjectOfFreeDecision'],
    [FILES.freeDecision, 'generateFreeDecision'],
    [FILES.freeDecision, 'publishProjectOfFreeDecision'],
    [FILES.freeDecision, 'createProjectOfFreeDecision'],
    [FILES.agenda, 'getAgenda'],
    [FILES.templates, 'documentTemplates'],
    [FILES.templates, 'documentTemplatesAttention'],
    [FILES.templates, 'documentTemplateBlank'],
    [FILES.templates, 'documentApprovalsSeedPlan'],
  ];
  const CHAIRMAN: [string, string][] = [
    [FILES.meet, 'restartAnnualGeneralMeet'],
    [FILES.decision, 'authorizeDecision'],
    [FILES.decision, 'declineDecision'],
    [FILES.templates, 'proposeDocumentApproval'],
    [FILES.templates, 'applyDocumentApprovalsSeed'],
  ];

  // core.rights.happy.01
  it.each(COUNCIL)('%s %s: член совета и председатель проходят, пайщик получает отказ', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, councilMember)).resolves.toBe(true);
    await expect(pass(requirement, chairman)).resolves.toBe(true);
    await expect(pass(requirement, participant)).rejects.toMatchObject(NO_RIGHT);
  });

  // core.rights.side.01
  it.each(CHAIRMAN)('%s %s: председатель проходит, член совета получает отказ', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, chairman)).resolves.toBe(true);
    await expect(pass(requirement, councilMember)).rejects.toMatchObject(NO_RIGHT);
  });

  // core.rights.side.02
  it('документ свободного решения и документы созыва на своё имя рядовой пайщик и кандидат больше не получают', async () => {
    const { pass } = makeGuard();
    for (const [file, operation] of [
      [FILES.freeDecision, 'generateFreeDecision'],
      [FILES.meet, 'generateAnnualGeneralMeetAgendaDocument'],
      [FILES.meet, 'generateSovietDecisionOnAnnualMeetDocument'],
    ]) {
      const requirement = requirementOf(file, operation);
      await expect(pass(requirement, participant, { data: { username: 'ivan' } })).rejects.toMatchObject(NO_RIGHT);
      await expect(pass(requirement, candidate, { data: { username: 'cand' } })).rejects.toMatchObject(NO_RIGHT);
    }
  });
});

describe('собрания: права пайщика на своё имя', () => {
  const OWN_NAME: [string, string][] = [
    [FILES.meet, 'voteOnAnnualGeneralMeet'],
    [FILES.meet, 'generateBallotForAnnualGeneralMeetDocument'],
    [FILES.meet, 'notifyOnAnnualGeneralMeet'],
    [FILES.meet, 'generateAnnualGeneralMeetNotificationDocument'],
  ];

  // core.rights.happy.02
  it.each(OWN_NAME)('%s %s: пайщик проходит на своё имя', async (file, operation) => {
    const { pass } = makeGuard();
    await expect(pass(requirementOf(file, operation), participant, { data: { username: 'ivan' } })).resolves.toBe(true);
  });

  // core.rights.side.03
  it.each(OWN_NAME)('%s %s: чужое имя в запросе — отказ и пайщику, и совету, и председателю', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    for (const caller of [participant, councilMember, chairman]) {
      await expect(pass(requirement, caller, { data: { username: 'drugoy' } })).rejects.toMatchObject(OWN);
    }
  });

  // core.rights.side.04
  it.each(OWN_NAME)('%s %s: кандидат прав пайщика не имеет даже на своё имя', async (file, operation) => {
    const { pass } = makeGuard();
    await expect(pass(requirementOf(file, operation), candidate, { data: { username: 'cand' } })).rejects.toMatchObject(NO_RIGHT);
  });

  // core.rights.happy.03
  it('собрание и список собраний читает принятый пайщик и совет; кандидат — нет', async () => {
    const { pass } = makeGuard();
    for (const operation of ['getMeet', 'getMeets']) {
      const requirement = requirementOf(FILES.meet, operation);
      await expect(pass(requirement, participant)).resolves.toBe(true);
      await expect(pass(requirement, { ...councilMember, status: 'registered' })).resolves.toBe(true);
      await expect(pass(requirement, candidate)).rejects.toMatchObject(NO_RIGHT);
    }
  });
});

describe('собрания: председатель и секретарь собрания', () => {
  const MEETS = { m1: { presider: 'ant', secretary: 'petr' } };

  // core.rights.side.05
  it('протокол подписывает секретарь собрания на своё имя; остальным отказ', async () => {
    const { pass } = makeGuard({ meets: MEETS });
    const requirement = requirementOf(FILES.meet, 'signBySecretaryOnAnnualGeneralMeet');
    await expect(pass(requirement, councilMember, { data: { hash: 'm1', username: 'petr' } })).resolves.toBe(true);
    await expect(pass(requirement, chairman, { data: { hash: 'm1', username: 'ant' } })).rejects.toMatchObject(OWN);
    await expect(pass(requirement, councilMember, { data: { hash: 'm1', username: 'ant' } })).rejects.toMatchObject(OWN);
    await expect(pass(requirement, participant, { data: { hash: 'm1', username: 'ivan' } })).rejects.toMatchObject(OWN);
  });

  // core.rights.side.05
  it('протокол подписывает председатель собрания на своё имя; секретарю отказ', async () => {
    const { pass } = makeGuard({ meets: MEETS });
    const requirement = requirementOf(FILES.meet, 'signByPresiderOnAnnualGeneralMeet');
    await expect(pass(requirement, chairman, { data: { hash: 'm1', username: 'ant' } })).resolves.toBe(true);
    await expect(pass(requirement, councilMember, { data: { hash: 'm1', username: 'petr' } })).rejects.toMatchObject(OWN);
  });

  // core.rights.side.06
  it('документ протокола запрашивают председатель и секретарь собрания; постороннему пайщику отказ', async () => {
    const { pass } = makeGuard({ meets: MEETS });
    const requirement = requirementOf(FILES.meet, 'generateAnnualGeneralMeetDecisionDocument');
    await expect(pass(requirement, chairman, { data: { meet_hash: 'm1', username: 'ant' } })).resolves.toBe(true);
    await expect(pass(requirement, councilMember, { data: { meet_hash: 'm1', username: 'petr' } })).resolves.toBe(true);
    await expect(pass(requirement, participant, { data: { meet_hash: 'm1', username: 'ivan' } })).rejects.toMatchObject(OWN);
  });

  // core.rights.side.07
  it('собрания в базе узла нет — гард пропускает, отвечает сама операция', async () => {
    const { pass } = makeGuard();
    const requirement = requirementOf(FILES.meet, 'signByPresiderOnAnnualGeneralMeet');
    await expect(pass(requirement, chairman, { data: { hash: 'нет', username: 'ant' } })).resolves.toBe(true);
  });
});

describe('реестр документов', () => {
  // core.rights.happy.04
  it('совет читает документы любого пайщика; остальные вошедшие — свои, включая кандидата', async () => {
    const { pass } = makeGuard();
    const requirement = requirementOf(FILES.document, 'getDocuments');
    await expect(pass(requirement, councilMember, { data: { username: 'ivan' } })).resolves.toBe(true);
    await expect(pass(requirement, participant, { data: { username: 'ivan' } })).resolves.toBe(true);
    await expect(pass(requirement, candidate, { data: { username: 'cand' } })).resolves.toBe(true);
    await expect(pass(requirement, participant, { data: { username: 'petr' } })).rejects.toMatchObject(OWN);
  });
});

describe('состав операций', () => {
  it('под ролями в резолверах совета не осталось ни одной операции', () => {
    for (const file of Object.values(FILES)) {
      expect(readFileSync(join(APPLICATION, file), 'utf8')).not.toContain('@AuthRoles');
    }
  });

  it('вызов без входа получает отказ входа', async () => {
    const { pass } = makeGuard();
    await expect(pass(requirementOf(FILES.agenda, 'getAgenda'), null)).rejects.toMatchObject({ code: 'KIT_USER_NOT_AUTHORIZED' });
  });
});

describe('права страниц стола совета', () => {
  const grantsFor = async (caller: Caller) => {
    const { rights } = makeGuard();
    return desktopGrantsOf(rights).resolveGrants({ username: caller.username, userRole: caller.role, userStatus: caller.status });
  };
  const PAGES = ['Agenda:read', 'Participant:read:all', 'Document:read:all', 'DocumentTemplate:read', 'Payment:read:all', 'Expense:read:all', 'Meet:create', 'Union:read'];

  // core.rights.happy.05
  it('член совета получает права всех страниц стола совета', async () => {
    const grants = await grantsFor(councilMember);
    for (const grant of PAGES) expect(grants).toContain(grant);
  });

  // core.rights.side.08
  it('рядовой пайщик прав страниц стола совета не получает — стола не видит', async () => {
    const grants = await grantsFor(participant);
    for (const grant of PAGES) expect(grants).not.toContain(grant);
  });

  it('права ядра регистрируются для стола совета', () => {
    const { rights, registry } = makeGuard();
    rights.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(expect.objectContaining({ extensionName: 'soviet' }));
  });
});

describe('назначаемая роль «кассир» (C28-90)', () => {
  const CASHIER = { assigned: { ivan: ['cashier'], cand: ['cashier'] } };
  const PAYMENTS: [string, string, Record<string, unknown>][] = [
    [FILES.gateway, 'getPayments', { data: {} }],
    [FILES.gateway, 'setPaymentStatus', { data: { id: '1' } }],
    [FILES.paymentFiles, 'uploadPaymentProof', { data: {} }],
  ];
  const grantsFor = async (caller: Caller, stand = CASHIER) => {
    const { rights } = makeGuard(stand);
    return desktopGrantsOf(rights).resolveGrants({ username: caller.username, userRole: caller.role, userStatus: caller.status });
  };

  // access.roles.happy.06
  it.each(PAYMENTS)('кассир проходит операцию реестра платежей %s → %s', async (file, operation, args) => {
    const { pass } = makeGuard(CASHIER);
    await expect(pass(requirementOf(file, operation), participant, args)).resolves.toBe(true);
  });

  // access.roles.side.05
  it.each(PAYMENTS)('пайщик без роли на операции %s → %s получает отказ', async (file, operation, args) => {
    const { pass } = makeGuard();
    await expect(pass(requirementOf(file, operation), participant, args)).rejects.toMatchObject(
      operation === 'getPayments' ? OWN : NO_RIGHT
    );
  });

  // access.roles.happy.07
  it('кассир получает из страниц стола совета только реестр платежей', async () => {
    const grants = await grantsFor(participant);
    expect(grants).toContain('Payment:read:all');
    expect(grants).toContain('Payment:confirm');
    for (const grant of ['Agenda:read', 'Participant:read:all', 'Document:read:all', 'DocumentTemplate:read', 'Expense:read:all', 'Meet:create', 'Union:read', 'AccessRole:manage']) {
      expect(grants).not.toContain(grant);
    }
  });

  // access.roles.side.06
  it('назначение действует у принятого пайщика: кандидат с назначенной ролью прав кассира не получает', async () => {
    const { pass, roleAssignments } = makeGuard(CASHIER);
    await expect(pass(requirementOf(FILES.gateway, 'setPaymentStatus'), candidate, { data: { id: '1' } })).rejects.toMatchObject(NO_RIGHT);
    expect(roleAssignments.rolesOf).not.toHaveBeenCalled();
    expect(await grantsFor(candidate)).not.toContain('Payment:read:all');
  });

  // access.roles.happy.08
  it('ядро объявляет роль кассира под приложением стола совета', () => {
    const { rights, roleAssignments } = makeGuard();
    rights.onModuleInit();
    expect(roleAssignments.declare).toHaveBeenCalledWith('soviet', [expect.objectContaining({ key: 'cashier' })]);
  });

  // access.roles.happy.10
  it('реестр платежей член совета читает; подтверждают оплату и прикладывают документы председатель и кассир', async () => {
    const { pass } = makeGuard(CASHIER);
    await expect(pass(requirementOf(FILES.gateway, 'getPayments'), councilMember, { data: {} })).resolves.toBe(true);
    for (const operation of ['setPaymentStatus', 'uploadPaymentProof']) {
      const requirement = requirementOf(operation === 'setPaymentStatus' ? FILES.gateway : FILES.paymentFiles, operation);
      await expect(pass(requirement, councilMember, { data: { id: '1' } })).rejects.toMatchObject(NO_RIGHT);
      await expect(pass(requirement, chairman, { data: { id: '1' } })).resolves.toBe(true);
    }
    const grants = await grantsFor(councilMember);
    expect(grants).toContain('Payment:read:all');
    expect(grants).not.toContain('Payment:confirm');
  });

  // core.acc.happy.12
  it('право страницы управления доступом получает только председатель', async () => {
    expect(await grantsFor(chairman)).toContain('AccessRole:manage');
    expect(await grantsFor(councilMember)).not.toContain('AccessRole:manage');
    expect(await grantsFor(participant)).not.toContain('AccessRole:manage');
  });

  // access.roles.side.07
  it.each(['getAssignableRoles', 'assignRole', 'revokeRole'])('управление доступом (%s) — только председатель', async (operation) => {
    const { pass } = makeGuard(CASHIER);
    const requirement = requirementOf(FILES.accessRoles, operation);
    await expect(pass(requirement, chairman)).resolves.toBe(true);
    await expect(pass(requirement, councilMember)).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(requirement, participant)).rejects.toMatchObject(NO_RIGHT);
  });

  // access.roles.happy.12
  it('роль чужого приложения в ядре прав не даёт: бухгалтерию ядра бухгалтер не читает', async () => {
    const { pass } = makeGuard({ assigned: { ivan: ['accountant'] } });
    await expect(pass(requirementOf(FILES.ledger2, 'getLedger2Wallets'), participant)).rejects.toMatchObject(NO_RIGHT);
  });

  // access.roles.break.06
  it('назначение с ключом роли узла прав председателя не даёт', async () => {
    const { pass } = makeGuard({ assigned: { ivan: ['chairman'] } });
    await expect(pass(requirementOf(FILES.accessRoles, 'assignRole'), participant)).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(requirementOf(FILES.ledger2, 'getLedger2Wallets'), participant)).rejects.toMatchObject(NO_RIGHT);
  });
});
