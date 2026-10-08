/**
 * Аннулирование подписки по гарантийным условиям (п. 4.4.2–4.4.4 Положения о
 * ЦПП «Образование»): заявление участника рассматривает совет; удовлетворил —
 * вся стоимость возвращается на паевой, отклонил — остаётся обычный отказ.
 */
import { EdubridgeGuaranteeService } from '~/extensions/edubridge/application/services/edubridge-guarantee.service';
import { EduCouncilOutcome, EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';
import { EduGuaranteeClaimStatus } from '~/extensions/edubridge/domain/enums/guarantee-claim-status.enum';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const DAY = 24 * 60 * 60 * 1000;

function make(opts: { guaranteeDays?: number; startedDaysAgo?: number; status?: EduEnrollmentStatus; claim?: any; projectFails?: boolean } = {}) {
  const enrollment = {
    id: 'E1',
    coopname: 'voskhod',
    member_username: 'ant',
    course_id: 'C1',
    sub_hash: 'S1',
    status: opts.status ?? EduEnrollmentStatus.ACTIVE,
    paid_amount: '1000.0000 RUB',
    created_at: new Date(Date.now() - 30 * DAY),
  } as any;
  const course = {
    id: 'C1',
    title: 'Алгебра',
    guarantee_days: opts.guaranteeDays ?? 14,
    starts_at: new Date(Date.now() - (opts.startedDaysAgo ?? 3) * DAY),
  } as any;
  const store: { claim: any } = { claim: opts.claim ?? null };
  const claims = {
    findById: jest.fn(async () => store.claim),
    findByEnrollment: jest.fn(async () => store.claim),
    findByEnrollments: jest.fn(async () => (store.claim ? [store.claim] : [])),
    findByAgendaId: jest.fn(async (_c: string, id: string) => (store.claim?.council_agenda_id === id ? store.claim : null)),
    findSubmittedWithoutProject: jest.fn(async () => (store.claim && !store.claim.council_project_hash ? [store.claim] : [])),
    create: jest.fn((d: any) => ({ id: 'G1', ...d })),
    save: jest.fn(async (c: any) => { store.claim = c; return c; }),
  } as any;
  const enrollments = { findById: jest.fn(async () => enrollment), findByMember: jest.fn(async () => [enrollment]) } as any;
  const courses = { findById: jest.fn(async () => course) } as any;
  const enrollmentService = { cancelByGuarantee: jest.fn(async () => enrollment) } as any;
  const chain = { claimGuarantee: jest.fn(async () => ({})), declineGuarantee: jest.fn(async () => ({})) } as any;
  const documents = { generate: jest.fn(async (r: any) => ({ hash: `H${r.data.registry_id}`, html: '', full_title: '', binary: '', meta: {} })) } as any;
  const freeDecisions = {
    createProjectOfFreeDecision: jest.fn(async () => {
      if (opts.projectFails) throw new Error('совет недоступен');
    }),
    generateProjectOfFreeDecisionDocument: jest.fn(async () => ({ hash: 'PROJECT', meta: {} })),
    publishProjectOfFreeDecision: jest.fn(async () => undefined),
  } as any;
  const tracking = { registerTrackingRule: jest.fn(async () => undefined) } as any;
  const council = { getDecisions: jest.fn(async () => [{ id: 7, hash: 'project' }]) } as any;
  const service = new EdubridgeGuaranteeService(claims, enrollments, courses, enrollmentService, chain, documents, freeDecisions, tracking, council, logger, { viewOf: (c: any) => c, courseOf: jest.fn(async (...a: any[]) => (courses as any).findById(a[0], a[1])), openFor: jest.fn(async () => ({ id: 'G1', chain_ref: '3', course_id: 'C1' })), get: jest.fn(async () => ({ id: 'G1', chain_ref: '3', course_id: 'C1' })), list: jest.fn(async () => [{ id: 'G1', chain_ref: '7', course_id: 'C1', status: 'active', starts_at: null, teacher_reserve_balance: null, teacher_settled_total: null }]), firstOf: jest.fn(async () => ({ id: 'G1', chain_ref: '7', course_id: 'C1', status: 'active' })), saveFunds: jest.fn(async (g: any, r: string, st: string) => { g.teacher_reserve_balance = r; g.teacher_settled_total = st; return true; }) } as any);
  return { service, claims, chain, documents, freeDecisions, tracking, enrollmentService, store, enrollment };
}

const signed = { hash: 'DOC', meta: {}, signatures: [{ signer: 'ant' }] } as any;

describe('EdubridgeGuaranteeService', () => {
  it('в гарантийный срок заявление доступно; сумма — вся стоимость подписки', async () => {
    const [state] = await make().service.statesOf('voskhod', 'ant');
    expect(state.available).toBe(true);
    expect(state.amount).toBe('1000.0000 RUB');
    expect(state.guarantee_until).toBeInstanceOf(Date);
  });

  it('срок истёк, гарантии у курса нет, подписка закрыта — заявление недоступно и подать его нельзя', async () => {
    for (const opts of [{ startedDaysAgo: 40 }, { guaranteeDays: 0 }, { status: EduEnrollmentStatus.CANCELLED }]) {
      const { service } = make(opts);
      expect((await service.statesOf('voskhod', 'ant'))[0].available).toBe(false);
      await expect(service.submit('voskhod', 'ant', 'E1', 'причина', [], signed)).rejects.toMatchObject({ code: 'EDUBRIDGE_GUARANTEE_NOT_AVAILABLE' });
    }
  });

  it('подача: заявление уходит в цепь, вопрос выносится на совет с номером повестки', async () => {
    const { service, chain, tracking, store } = make();
    const claim = await service.submit('voskhod', 'ant', 'E1', '  не подошла программа  ', [' https://x.ru/a ', ''], signed);
    expect(chain.claimGuarantee).toHaveBeenCalledWith(expect.objectContaining({ username: 'ant', sub_hash: 'S1' }));
    expect(claim.status).toBe(EduGuaranteeClaimStatus.SUBMITTED);
    expect(claim.reason).toBe('не подошла программа');
    expect(claim.links).toEqual(['https://x.ru/a']);
    expect(claim.amount).toBe('1000.0000 RUB');
    expect(store.claim.council_project_hash).toBe('project');
    expect(store.claim.council_agenda_id).toBe('7');
    expect(tracking.registerTrackingRule.mock.calls[0][0].metadata).toMatchObject({ extension: 'edubridge', guarantee_claim_id: 'G1' });
  });

  it('чужая подписка, пустая причина, заявление без подписи участника, повторное заявление — отказ', async () => {
    await expect(make().service.submit('voskhod', 'другой', 'E1', 'причина', [], signed)).rejects.toMatchObject({ code: 'EDUBRIDGE_SUBSCRIPTION_NOT_FOUND' });
    await expect(make().service.submit('voskhod', 'ant', 'E1', 'причина', [], { ...signed, signatures: [] })).rejects.toMatchObject({ code: 'EDUBRIDGE_GUARANTEE_NOT_SIGNED' });
    await expect(make().service.statement('voskhod', 'ant', 'E1', '   ', [])).rejects.toMatchObject({ code: 'EDUBRIDGE_GUARANTEE_REASON_REQUIRED' });
    const again = make({ claim: { id: 'G1', enrollment_id: 'E1', status: EduGuaranteeClaimStatus.DECLINED } });
    await expect(again.service.submit('voskhod', 'ant', 'E1', 'причина', [], signed)).rejects.toMatchObject({ code: 'EDUBRIDGE_GUARANTEE_ALREADY_CLAIMED' });
  });

  it('сбой при вынесении на совет оставляет заявление поданным; очередь довыносит вопрос', async () => {
    const failing = make({ projectFails: true });
    const claim = await failing.service.submit('voskhod', 'ant', 'E1', 'причина', [], signed);
    expect(claim.status).toBe(EduGuaranteeClaimStatus.SUBMITTED);
    expect(claim.council_project_hash ?? null).toBeNull();

    const later = make({ claim: { ...claim } });
    await expect(later.service.publishPending('voskhod')).resolves.toBe(1);
    expect(later.store.claim.council_project_hash).toBe('project');
  });

  it('совет удовлетворил: подписка закрывается с протоколом, заявление удовлетворено', async () => {
    const pending = { id: 'G1', coopname: 'voskhod', member_username: 'ant', enrollment_id: 'E1', course_id: 'C1', claim_hash: 'abcdef0123', amount: '1000.0000 RUB', status: EduGuaranteeClaimStatus.SUBMITTED };
    const { service, enrollmentService, store, enrollment } = make({ claim: pending });
    await service.onDecisionTracked({ result: { matched: true, metadata: { extension: 'edubridge', guarantee_claim_id: 'G1' }, decision_id: 12, decision_date: '2026-10-05T10:00:00Z' } } as any);
    expect(enrollmentService.cancelByGuarantee).toHaveBeenCalledWith('voskhod', enrollment, expect.objectContaining({ claim_hash: 'abcdef0123' }));
    expect(store.claim.status).toBe(EduGuaranteeClaimStatus.APPROVED);
    expect(store.claim.council_decision_id).toBe('12');
    expect(store.claim.decision_hash).toBe('h3014');
  });

  it('решение совета по чужому вопросу и повторное решение заявление не трогают', async () => {
    const done = make({ claim: { id: 'G1', status: EduGuaranteeClaimStatus.APPROVED } });
    await done.service.onDecisionTracked({ result: { matched: true, metadata: { extension: 'edubridge', guarantee_claim_id: 'G1' } } } as any);
    await done.service.onDecisionTracked({ result: { matched: true, metadata: { extension: 'edubridge', rid_hash: 'r' } } } as any);
    expect(done.enrollmentService.cancelByGuarantee).not.toHaveBeenCalled();
  });

  it('совет отклонил либо не решил в срок: заявление закрывается, заморозка взноса снимается, подписка остаётся', async () => {
    for (const [outcome, status] of [[EduCouncilOutcome.DECLINED, EduGuaranteeClaimStatus.DECLINED], [EduCouncilOutcome.EXPIRED, EduGuaranteeClaimStatus.EXPIRED]] as const) {
      const { service, store, enrollmentService, chain, enrollment } = make({ claim: { id: 'G1', council_agenda_id: '7', enrollment_id: 'E1', member_username: 'ant', status: EduGuaranteeClaimStatus.SUBMITTED } });
      await service.onCouncilGaveUp('voskhod', '7', outcome);
      expect(store.claim.status).toBe(status);
      expect(enrollmentService.cancelByGuarantee).not.toHaveBeenCalled();
      // Взнос был заморожен подачей заявления — контракт снимает заморозку по этой подписке.
      expect(chain.declineGuarantee).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'ant', sub_hash: enrollment.sub_hash });
    }
  });

  it('отказ совета: сбой снятия заморозки заявление не возвращает на рассмотрение', async () => {
    const { service, store, chain } = make({ claim: { id: 'G1', council_agenda_id: '7', enrollment_id: 'E1', member_username: 'ant', status: EduGuaranteeClaimStatus.SUBMITTED } });
    chain.declineGuarantee.mockRejectedValueOnce(new Error('цепь недоступна'));
    await service.onCouncilGaveUp('voskhod', '7', EduCouncilOutcome.DECLINED);
    expect(store.claim.status).toBe(EduGuaranteeClaimStatus.DECLINED);
  });
});
