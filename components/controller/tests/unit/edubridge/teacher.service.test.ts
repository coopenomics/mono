/** Преподавательский контур: ДУХД и приложение двухподписные через одобрение председателя, взнос РИД, решение совета, акт → acceptrid, отклонение. */
import { DecisionEventType, DecisionTrackedEvent } from '@coopenomics/innercoop';
import { EdubridgeTeacherService } from '~/extensions/edubridge/application/services/edubridge-teacher.service';
import { EduAssignmentStatus, EduContractStatus, EduContributionStatus, EduRidType } from '~/extensions/edubridge/domain/enums';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const signedBy = (signer: string, hash = 'ABC') => ({ hash, doc_hash: hash, meta_hash: hash, version: '1.0', meta: {}, signatures: [{ signer }] }) as any;

function make(opts: { contract?: boolean | EduContractStatus; assignmentStatus?: EduAssignmentStatus } = {}) {
  const assignment = { id: 'A1', coopname: 'voskhod', teacher_username: 'teach', course_id: 'C1', annex_hash: null, decline_reason: '', status: opts.assignmentStatus ?? EduAssignmentStatus.ACTIVE, created_at: new Date('2026-01-01') } as any;
  const store = new Map<string, any>();
  const contractState: { current: any } = {
    current: opts.contract === false ? null : { coopname: 'voskhod', teacher_username: 'teach', contract_hash: 'h', contract_number: 'N1', status: typeof opts.contract === 'string' ? opts.contract : EduContractStatus.ACTIVE, decline_reason: '', approved_at: null },
  };
  const teachers = {
    findContract: jest.fn(async () => contractState.current),
    saveContract: jest.fn(async (d: any) => { contractState.current = { ...d }; return contractState.current; }),
    findAssignment: jest.fn(async () => assignment),
    findAssignmentByAnnexHash: jest.fn(async (_c: string, h: string) => (assignment.annex_hash === h.toLowerCase() ? assignment : null)),
    listAssignments: jest.fn(async () => [assignment]),
    createAssignment: jest.fn((d: any) => ({ ...d })),
    saveAssignment: jest.fn(async (a: any) => a),
    listContributions: jest.fn(async () => [...store.values()]),
    findContribution: jest.fn(async (_c: string, id: string) => store.get(id) ?? null),
    findContributionByRidHash: jest.fn(async (h: string) => [...store.values()].find((c) => c.rid_hash === h) ?? null),
    createContribution: jest.fn((d: any) => ({ ...d, id: 'K1', created_at: new Date('2026-02-01'), links: d.links })),
    saveContribution: jest.fn(async (c: any) => { store.set(c.id, c); return c; }),
  } as any;
  const courses = { findById: jest.fn(async () => ({ id: 'C1', title: 'Алгебра', chain_ref: '7' })) } as any;
  const chain = {
    submitRid: jest.fn(async () => ({})), acceptRid: jest.fn(async () => ({})), declineRid: jest.fn(async () => ({})),
    signContract: jest.fn(async () => ({})), signAnnex: jest.fn(async () => ({})),
  } as any;
  const documents = {
    generate: jest.fn(async (r: any) => ({ hash: `H${r.data.registry_id}`, html: '', full_title: '', binary: '', meta: {} })),
    buildAggregate: jest.fn(async (d: any) => ({ hash: d.hash, document: d, rawDocument: { hash: d.hash, html: '', meta: {} } })),
  } as any;
  const freeDecisions = {
    createProjectOfFreeDecision: jest.fn(async () => ({})),
    generateProjectOfFreeDecisionDocument: jest.fn(async () => ({ hash: 'PROJ', meta: {} })),
    publishProjectOfFreeDecision: jest.fn(async () => true),
  } as any;
  const tracking = { registerTrackingRule: jest.fn(async () => ({})) } as any;
  const wallets = { findByWalletAndUsername: jest.fn(async () => ({ available: '7000.0000 RUB' })) } as any;
  const events = { emit: jest.fn() } as any;
  const service = new EdubridgeTeacherService(teachers, courses, chain, documents, freeDecisions, tracking, wallets, logger, events);
  return { service, teachers, chain, documents, freeDecisions, tracking, store, assignment };
}

const draft = { assignment_id: 'A1', rid_type: EduRidType.LESSON_RECORDING, links: ['https://x/1'], amount: '5000.0000 RUB' };

describe('EdubridgeTeacherService — договор УХД и приложение через одобрение председателя', () => {
  it('подпись договора преподавателем: signcontract в цепь, статус «ждёт подписи председателя»', async () => {
    const { service, chain } = make({ contract: false });
    const c = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT'), 'N-1');
    expect(chain.signContract).toHaveBeenCalledWith(expect.objectContaining({ username: 'teach', contract_hash: 'CONTRACT' }));
    expect(c.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(c.contract_hash).toBe('contract');
  });

  it('договор без подписи преподавателя не уходит в цепь', async () => {
    const { service, chain } = make({ contract: false });
    await expect(service.signContract('voskhod', 'teach', signedBy('someone', 'X'), 'N')).rejects.toThrow(/не подписан преподавателем/);
    expect(chain.signContract).not.toHaveBeenCalled();
  });

  it('пока договор ждёт председателя — приложение и взнос недоступны', async () => {
    const { service, chain } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await expect(service.signAnnex('voskhod', 'teach', 'A1', signedBy('teach', 'ANNEX'))).rejects.toThrow(/ещё не подписан председателем/);
    await expect(service.draftContribution('voskhod', 'teach', draft)).rejects.toThrow(/ещё не подписан председателем/);
    expect(chain.signAnnex).not.toHaveBeenCalled();
  });

  it('коллбэк совета apprvcontr делает договор действующим; dclinecontr — отклонённым с причиной, и его можно подписать заново', async () => {
    const { service, chain } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await service.onContractApproved('voskhod', 'teach', 'H');
    expect((await service.contract('voskhod', 'teach'))!.status).toBe(EduContractStatus.ACTIVE);

    await service.onContractDeclined('voskhod', 'teach', 'H', 'Нет квалификации');
    const declined = (await service.contract('voskhod', 'teach'))!;
    expect(declined.status).toBe(EduContractStatus.DECLINED);
    expect(declined.decline_reason).toBe('Нет квалификации');

    const again = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT2'), 'N-2');
    expect(chain.signContract).toHaveBeenCalledTimes(1);
    expect(again.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(again.contract_hash).toBe('contract2');
  });

  it('действующий договор повторно не подписывается — возвращается тот же', async () => {
    const { service, chain } = make();
    const c = await service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N-9');
    expect(chain.signContract).not.toHaveBeenCalled();
    expect(c.contract_hash).toBe('h');
  });

  it('приложение: signannex в цепь с числовым курсом, назначение ждёт председателя; apprvannex → активно', async () => {
    const { service, chain, assignment } = make({ assignmentStatus: EduAssignmentStatus.DRAFT });
    const a = await service.signAnnex('voskhod', 'teach', 'A1', signedBy('teach', 'ANNEX'));
    expect(chain.signAnnex).toHaveBeenCalledWith(expect.objectContaining({ username: 'teach', course_id: 7, annex_hash: 'ANNEX' }));
    expect(a.status).toBe(EduAssignmentStatus.PENDING_APPROVAL);
    expect(a.annex_hash).toBe('annex');

    await service.onAnnexApproved('voskhod', 'teach', 'ANNEX');
    expect(assignment.status).toBe(EduAssignmentStatus.ACTIVE);
  });

  it('приложение: отказ председателя → DECLINED с причиной, подписывается заново; чужое назначение — запрет', async () => {
    const { service, assignment } = make({ assignmentStatus: EduAssignmentStatus.DRAFT });
    await service.signAnnex('voskhod', 'teach', 'A1', signedBy('teach', 'ANNEX'));
    await service.onAnnexDeclined('voskhod', 'teach', 'ANNEX', 'Расписание не согласовано');
    expect(assignment.status).toBe(EduAssignmentStatus.DECLINED);
    expect(assignment.decline_reason).toBe('Расписание не согласовано');

    const again = await service.signAnnex('voskhod', 'teach', 'A1', signedBy('teach', 'ANNEX2'));
    expect(again.status).toBe(EduAssignmentStatus.PENDING_APPROVAL);
    await expect(service.signAnnex('voskhod', 'other', 'A1', signedBy('other', 'Z'))).rejects.toThrow();
  });

  it('уже подписанное приложение повторно не уходит в цепь', async () => {
    const { service, chain } = make({ assignmentStatus: EduAssignmentStatus.PENDING_APPROVAL });
    await expect(service.signAnnex('voskhod', 'teach', 'A1', signedBy('teach', 'ANNEX'))).rejects.toThrow(/уже подписано/);
    expect(chain.signAnnex).not.toHaveBeenCalled();
  });
});

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

  it('решение совета → COUNCIL_APPROVED; акт преподавателя → ACT_SIGNED; тот же акт с подписью председателя → acceptrid, ACCEPTED', async () => {
    const { service, chain, documents } = make();
    const c = await service.draftContribution('voskhod', 'teach', draft);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onDecisionTracked(new DecisionTrackedEvent({ matched: true, hash: 'PROJ', event_type: DecisionEventType.SOVIET_DECISION, decision_id: '17', decision_date: '2026-03-01', metadata: { extension: 'edubridge', rid_hash: c.rid_hash } }));
    const approved = await service.listContributions('voskhod', 'teach');
    expect(approved[0]!.status).toBe(EduContributionStatus.COUNCIL_APPROVED);
    expect(approved[0]!.council_decision_id).toBe('17');

    await expect(service.act('voskhod', 'teach', c.id)).resolves.toBeTruthy();
    const teacherAct = signedBy('teach', 'ACT');
    const signedByTeacher = await service.signAct('voskhod', 'teach', c.id, teacherAct);
    expect(signedByTeacher.status).toBe(EduContributionStatus.ACT_SIGNED);
    expect(chain.acceptRid).not.toHaveBeenCalled();

    // Председатель получает тот же документ и подписывает его вторым — без перегенерации.
    const payload = await service.actSignablePayload('voskhod', c.id);
    expect(payload.hash).toBe('ACT');
    expect(documents.generate.mock.calls.filter((x: any) => x[0].data.registry_id === 3010).length).toBe(1);

    const bothSigned = { ...teacherAct, signatures: [{ signer: 'teach' }, { signer: 'ant' }] };
    const accepted = await service.acceptContribution('voskhod', 'ant', c.id, bothSigned);
    expect(chain.acceptRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, act: expect.objectContaining({ hash: 'ACT' }) }));
    expect(documents.generate.mock.calls.some((x: any) => x[0].data.registry_id === 3009 && x[0].data.decision_id === 17)).toBe(true);
    expect(accepted.status).toBe(EduContributionStatus.ACCEPTED);
  });

  it('приём отклоняется, если на акте нет обеих подписей или хэш другой', async () => {
    const { service } = make();
    const c = await service.draftContribution('voskhod', 'teach', draft);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onDecisionTracked(new DecisionTrackedEvent({ matched: true, hash: 'PROJ', event_type: DecisionEventType.SOVIET_DECISION, decision_id: '1', metadata: { extension: 'edubridge', rid_hash: c.rid_hash } }));
    await service.signAct('voskhod', 'teach', c.id, signedBy('teach', 'ACT'));
    await expect(service.acceptContribution('voskhod', 'ant', c.id, signedBy('teach', 'ACT'))).rejects.toThrow(/подписи преподавателя и председателя/);
    await expect(service.acceptContribution('voskhod', 'ant', c.id, { ...signedBy('ant', 'OTHER'), signatures: [{ signer: 'teach' }, { signer: 'ant' }] })).rejects.toThrow(/хэш акта/);
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
