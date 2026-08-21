/** Преподавательский контур: ДУХД как гейт, подача взноса РИД, решение совета, акт → acceptrid, отклонение. */
import { DecisionEventType, DecisionTrackedEvent } from '@coopenomics/innercoop';
import { EdubridgeTeacherService } from '~/extensions/edubridge/application/services/edubridge-teacher.service';
import { EduAssignmentStatus, EduContributionStatus, EduRidType } from '~/extensions/edubridge/domain/enums';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const signedBy = (signer: string, hash = 'ABC') => ({ hash, doc_hash: hash, meta_hash: hash, version: '1.0', meta: {}, signatures: [{ signer }] }) as any;

function make(opts: { contract?: boolean; assignmentStatus?: EduAssignmentStatus } = {}) {
  const assignment = { id: 'A1', coopname: 'voskhod', teacher_username: 'teach', course_id: 'C1', status: opts.assignmentStatus ?? EduAssignmentStatus.ACTIVE, created_at: new Date('2026-01-01') } as any;
  const store = new Map<string, any>();
  const teachers = {
    findContract: jest.fn(async () => (opts.contract === false ? null : { contract_hash: 'h' })),
    saveContract: jest.fn(async (d: any) => d),
    findAssignment: jest.fn(async () => assignment),
    listAssignments: jest.fn(async () => [assignment]),
    createAssignment: jest.fn((d: any) => ({ ...d })),
    saveAssignment: jest.fn(async (a: any) => a),
    listContributions: jest.fn(async () => [...store.values()]),
    findContribution: jest.fn(async (_c: string, id: string) => store.get(id) ?? null),
    findContributionByRidHash: jest.fn(async (h: string) => [...store.values()].find((c) => c.rid_hash === h) ?? null),
    createContribution: jest.fn((d: any) => ({ ...d, id: 'K1', created_at: new Date('2026-02-01'), links: d.links })),
    saveContribution: jest.fn(async (c: any) => { store.set(c.id, c); return c; }),
  } as any;
  const courses = { findById: jest.fn(async () => ({ id: 'C1', title: 'Алгебра' })) } as any;
  const chain = { submitRid: jest.fn(async () => ({})), acceptRid: jest.fn(async () => ({})), declineRid: jest.fn(async () => ({})) } as any;
  const documents = { generate: jest.fn(async (r: any) => ({ hash: `H${r.data.registry_id}`, html: '', full_title: '', binary: '', meta: {} })) } as any;
  const freeDecisions = {
    createProjectOfFreeDecision: jest.fn(async () => ({})),
    generateProjectOfFreeDecisionDocument: jest.fn(async () => ({ hash: 'PROJ', meta: {} })),
    publishProjectOfFreeDecision: jest.fn(async () => true),
  } as any;
  const tracking = { registerTrackingRule: jest.fn(async () => ({})) } as any;
  const wallets = { findByWalletAndUsername: jest.fn(async () => ({ available: '7000.0000 RUB' })) } as any;
  const events = { emit: jest.fn() } as any;
  const service = new EdubridgeTeacherService(teachers, courses, chain, documents, freeDecisions, tracking, wallets, logger, events);
  return { service, teachers, chain, documents, freeDecisions, tracking, store };
}

const draft = { assignment_id: 'A1', rid_type: EduRidType.LESSON_RECORDING, links: ['https://x/1'], amount: '5000.0000 RUB' };

describe('EdubridgeTeacherService', () => {
  it('без договора УХД взнос не подготовить', async () => {
    const { service } = make({ contract: false });
    await expect(service.draftContribution('voskhod', 'teach', draft)).rejects.toThrow(/договор участия/);
  });

  it('назначение без подписанного приложения — взнос не подготовить', async () => {
    const { service } = make({ assignmentStatus: EduAssignmentStatus.DRAFT });
    await expect(service.draftContribution('voskhod', 'teach', draft)).rejects.toThrow(/приложение/);
  });

  it('подача: submitrid, проект решения совета, правило отслеживания, статус SUBMITTED', async () => {
    const { service, chain, freeDecisions, tracking } = make();
    const c = await service.draftContribution('voskhod', 'teach', draft);
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(chain.submitRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, amount: '5000.0000 RUB' }));
    expect(freeDecisions.publishProjectOfFreeDecision).toHaveBeenCalled();
    expect(tracking.registerTrackingRule).toHaveBeenCalledWith(expect.objectContaining({ hash: 'PROJ', event_type: DecisionEventType.SOVIET_DECISION, metadata: expect.objectContaining({ rid_hash: c.rid_hash }) }));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(submitted.statement_hash).toBe('stmt');
  });

  it('решение совета → COUNCIL_APPROVED; акт преподавателя → acceptrid с протоколом 3009, статус ACCEPTED', async () => {
    const { service, chain, documents } = make();
    const c = await service.draftContribution('voskhod', 'teach', draft);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onDecisionTracked(new DecisionTrackedEvent({ matched: true, hash: 'PROJ', event_type: DecisionEventType.SOVIET_DECISION, decision_id: '17', decision_date: '2026-03-01', metadata: { extension: 'edubridge', rid_hash: c.rid_hash } }));
    const approved = await service.listContributions('voskhod', 'teach');
    expect(approved[0]!.status).toBe(EduContributionStatus.COUNCIL_APPROVED);
    expect(approved[0]!.council_decision_id).toBe('17');

    await expect(service.act('voskhod', 'teach', c.id)).resolves.toBeTruthy();
    const accepted = await service.signAct('voskhod', 'teach', c.id, signedBy('teach', 'ACT'));
    expect(chain.acceptRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, act: expect.objectContaining({ hash: 'ACT' }) }));
    expect(documents.generate.mock.calls.some((x: any) => x[0].data.registry_id === 3009 && x[0].data.decision_id === 17)).toBe(true);
    expect(accepted.status).toBe(EduContributionStatus.ACCEPTED);
    expect(accepted.act_hash).toBe('act');
  });

  it('акт до решения совета недоступен; чужое решение игнорируется', async () => {
    const { service } = make();
    const c = await service.draftContribution('voskhod', 'teach', draft);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onDecisionTracked(new DecisionTrackedEvent({ matched: true, hash: 'X', event_type: DecisionEventType.SOVIET_DECISION, metadata: { extension: 'market' } }));
    await expect(service.act('voskhod', 'teach', c.id)).rejects.toThrow(/после решения совета/);
  });

  it('отклонение: declinerid с протоколом, причина сохранена', async () => {
    const { service, chain } = make();
    const c = await service.draftContribution('voskhod', 'teach', draft);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    const declined = await service.decline('voskhod', c.id, 'Материал не соответствует программе');
    expect(chain.declineRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash }));
    expect(declined.status).toBe(EduContributionStatus.DECLINED);
    expect(declined.decline_reason).toMatch(/не соответствует/);
  });

  it('расчёт: сумма принятых и доступное в главном кошельке', async () => {
    const { service, store } = make();
    store.set('Z', { status: EduContributionStatus.ACCEPTED, amount: '5000.0000 RUB', decided_at: new Date('2026-03-02'), teacher_username: 'teach' });
    const s = await service.settlement('voskhod', 'teach');
    expect(s.accepted_total).toBe('5000.0000 RUB');
    expect(s.available).toBe('7000.0000 RUB');
  });
});
