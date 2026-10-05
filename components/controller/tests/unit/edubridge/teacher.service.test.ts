/** Преподавательский контур: ДУХД и приложение двухподписные через одобрение председателя, взнос РИД, решение совета, акт → acceptrid, отклонение. */
import { DecisionEventType, DecisionTrackedEvent } from '@coopenomics/innercoop';
import { EdubridgeTeacherService, coursePeriod, rateCoverageError } from '~/extensions/edubridge/application/services/edubridge-teacher.service';
import { EduAssignmentStatus, EduContractStatus, EduContributionStatus, EduCouncilOutcome } from '~/extensions/edubridge/domain/enums';
import { Cooperative } from 'cooptypes';
import { EduAssignmentDTO } from '~/extensions/edubridge/application/dto/edu-teacher.dto';

const R = Cooperative.Registry;

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const signedBy = (signer: string, hash = 'ABC') => ({ hash, doc_hash: hash, meta_hash: hash, version: '1.0', meta: {}, signatures: [{ signer }] }) as any;

function make(
  opts: { contract?: boolean | EduContractStatus; assignmentStatus?: EduAssignmentStatus; lessonsTotal?: number; guaranteeDays?: number; plannedRate?: string; startsAt?: Date | null; courseTeachers?: string[]; profile?: { about: string; hourly_rate: string } | null } = {}
) {
  const assignment = { id: 'A1', coopname: 'voskhod', teacher_username: 'teach', course_id: 'C1', status: opts.assignmentStatus ?? EduAssignmentStatus.ACTIVE, period_from: '2025-09-01', period_to: '2027-06-01', created_at: new Date('2026-01-01') } as any;
  const store = new Map<string, any>();
  const contractState: { current: any } = {
    current: opts.contract === false ? null : { coopname: 'voskhod', teacher_username: 'teach', contract_hash: 'h', contract_number: 'N1', hourly_rate: '1000.0000 RUB', status: typeof opts.contract === 'string' ? opts.contract : EduContractStatus.ACTIVE, decline_reason: '', approved_at: null },
  };
  const profileState: { current: any } = { current: opts.profile ? { coopname: 'voskhod', teacher_username: 'teach', ...opts.profile } : null };
  const teachers = {
    findContract: jest.fn(async () => contractState.current),
    listContracts: jest.fn(async () => (contractState.current ? [contractState.current] : [])),
    saveContract: jest.fn(async (d: any) => { contractState.current = { ...d }; return contractState.current; }),
    findProfile: jest.fn(async () => profileState.current),
    listProfiles: jest.fn(async () => (profileState.current ? [profileState.current] : [])),
    saveProfile: jest.fn(async (d: any) => { profileState.current = { ...d }; return profileState.current; }),
    findAssignment: jest.fn(async () => assignment),
    listAssignments: jest.fn(async () => [assignment]),
    createAssignment: jest.fn((d: any) => ({ ...d })),
    saveAssignment: jest.fn(async (a: any) => a),
    listContributions: jest.fn(async () => [...store.values()]),
    findContribution: jest.fn(async (_c: string, id: string) => store.get(id) ?? null),
    findContributionByRidHash: jest.fn(async (h: string) => [...store.values()].find((c) => c.rid_hash === h) ?? null),
    createContribution: jest.fn((d: any) => ({ ...d, id: 'K1', created_at: new Date('2026-02-01'), links: d.links })),
    saveContribution: jest.fn(async (c: any) => { store.set(c.id, c); return c; }),
    findHeldDue: jest.fn(async () => []),
    findSubmittedWithoutProject: jest.fn(async () => []),
    findContributionByAgendaId: jest.fn(async (_c: string, id: string) => [...store.values()].find((c) => c.council_agenda_id === id) ?? null),
  } as any;
  const courses = {
    findById: jest.fn(async () => ({
      id: 'C1',
      title: 'Алгебра',
      chain_ref: '7',
      lessons_total: opts.lessonsTotal ?? 64,
      lesson_minutes: 60,
      guarantee_days: opts.guaranteeDays ?? 14,
      planned_hourly_rate: opts.plannedRate ?? '1000.0000 RUB',
      starts_at: opts.startsAt ?? null,
      teacher_usernames: opts.courseTeachers ?? ['teach'],
    })),
    save: jest.fn(async (c: any) => c),
  } as any;
  const lessonStore = new Map<number, any>();
  const lessons = {
    findByNumber: jest.fn(async (_c: string, _course: string, n: number) => lessonStore.get(n) ?? null),
    findByTeacher: jest.fn(async () => [...lessonStore.values()]),
    findById: jest.fn(async (_c: string, id: string) => [...lessonStore.values()].find((l) => l.id === id) ?? null),
    create: jest.fn((d: any) => ({ id: `LS${d.lesson_number}`, ...d })),
    save: jest.fn(async (l: any) => { lessonStore.set(l.lesson_number, l); return l; }),
  } as any;
  const chain = {
    holdRid: jest.fn(async () => ({})), recallRid: jest.fn(async () => ({})),
    submitRid: jest.fn(async () => ({})), acceptRid: jest.fn(async () => ({})), declineRid: jest.fn(async () => ({})),
    signContract: jest.fn(async () => ({})), terminateContract: jest.fn(async () => ({})),
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
  // Вопрос в повестке совета находится по хэшу проекта решения.
  const council = { getDecisions: jest.fn(async () => [{ id: 77, hash: 'PROJ' }]) } as any;
  const wallets = { findByWalletAndUsername: jest.fn(async () => ({ available: '7000.0000 RUB' })) } as any;
  // Имя и фотография приходят из ядра портами — расширение своей копии не держит.
  const avatars = { getAvatarUrl: jest.fn(async () => null), getAvatarUrls: jest.fn(async () => new Map([['teach', '/backend/avatar.jpg']])) } as any;
  const names = { displayName: jest.fn(async () => 'Иванов Иван Иванович'), displayNames: jest.fn(async () => new Map([['teach', 'Иванов Иван Иванович']])) } as any;
  const funds = { onSettled: jest.fn(async () => undefined) } as any;
  const events = { emit: jest.fn() } as any;
  const service = new EdubridgeTeacherService(teachers, courses, lessons, chain, documents, freeDecisions, tracking, council, wallets, avatars, names, funds, logger, events);
  return { service, teachers, courses, chain, documents, freeDecisions, tracking, council, funds, store, assignment, avatars, names, lessons };
}


describe('EdubridgeTeacherService — договор УХД и приложение через одобрение председателя', () => {
  it('подпись договора преподавателем: signcontract в цепь, статус «ждёт подписи председателя»', async () => {
    const { service, chain } = make({ contract: false });
    const c = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT'), 'N-1', '1000.0000 RUB');
    expect(chain.signContract).toHaveBeenCalledWith(expect.objectContaining({ username: 'teach', contract_hash: 'CONTRACT' }));
    expect(c.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(c.contract_hash).toBe('contract');
  });

  it('договор без подписи преподавателя не уходит в цепь', async () => {
    const { service, chain } = make({ contract: false });
    await expect(service.signContract('voskhod', 'teach', signedBy('someone', 'X'), 'N', '1000.0000 RUB')).rejects.toThrow(/не подписан преподавателем/);
    expect(chain.signContract).not.toHaveBeenCalled();
  });

  it('пока договор ждёт председателя — отчёт по занятию и взнос недоступны, хотя допуск к курсу уже есть', async () => {
    const { service, store } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await expect(contributionOfLesson(service, store)).rejects.toThrow(/ещё не подписан председателем/);
  });

  it('коллбэк совета apprvcontr делает договор действующим; dclinecontr — отклонённым с причиной, и его можно подписать заново', async () => {
    const { service, chain } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await service.onContractApproved('voskhod', 'teach', 'H');
    expect((await service.contract('voskhod', 'teach'))!.status).toBe(EduContractStatus.ACTIVE);

    await service.onContractDeclined('voskhod', 'teach', 'H', 'Нет квалификации');
    const declined = (await service.contract('voskhod', 'teach'))!;
    expect(declined.status).toBe(EduContractStatus.DECLINED);
    expect(declined.decline_reason).toBe('Нет квалификации');

    const again = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT2'), 'N-2', '1000.0000 RUB');
    expect(chain.signContract).toHaveBeenCalledTimes(1);
    expect(again.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(again.contract_hash).toBe('contract2');
  });

  it('ставка часа названа один раз: переподписание с другой ставкой отклоняется', async () => {
    const { service } = make();
    await service.onContractDeclined('voskhod', 'teach', 'H', 'Нет квалификации');
    await expect(
      service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT3'), 'N-3', '5000.0000 RUB')
    ).rejects.toThrow(/её меняет администратор/);
  });

  it('прекращение договора: termcontract в цепь, статус «прекращён», подписывается заново — уже с новой ставкой', async () => {
    const { service, chain, teachers } = make();
    teachers.listAssignments.mockResolvedValue([]);
    const terminated = await service.terminateContract('voskhod', 'teach', 'выход преподавателя из кооператива');
    expect(chain.terminateContract).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'teach', contract_hash: 'h', reason: 'выход преподавателя из кооператива' });
    expect(terminated?.status).toBe(EduContractStatus.TERMINATED);
    await expect(service.reportLesson('voskhod', 'teach', { assignment_id: 'A1', lesson_number: 1, materials: ['x'] } as any)).rejects.toThrow(/прекращён/);

    const again = await service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N2', '1500.0000 RUB');
    expect(chain.signContract).toHaveBeenCalled();
    expect(again.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(again.hourly_rate).toBe('1500.0000 RUB');
  });

  it('договор не прекращается, пока преподаватель ведёт курс или по занятиям не закрыт расчёт', async () => {
    const { service, chain, teachers, store } = make();
    await expect(service.terminateContract('voskhod', 'teach', 'соглашение сторон')).rejects.toThrow(/ведёт курсы/);
    teachers.listAssignments.mockResolvedValue([]);
    store.set('K9', { id: 'K9', status: EduContributionStatus.HELD });
    await expect(service.terminateContract('voskhod', 'teach', 'соглашение сторон')).rejects.toThrow(/не закрыт расчёт/);
    expect(chain.terminateContract).not.toHaveBeenCalled();
  });

  it('прекращать нечего: без договора и с уже прекращённым в цепь не ходим; основание обязательно', async () => {
    const none = make({ contract: false });
    await expect(none.service.terminateContract('voskhod', 'teach', 'выход')).resolves.toBeNull();
    const done = make({ contract: EduContractStatus.TERMINATED });
    await done.service.terminateContract('voskhod', 'teach', 'выход');
    expect(done.chain.terminateContract).not.toHaveBeenCalled();
    const live = make();
    live.teachers.listAssignments.mockResolvedValue([]);
    await expect(live.service.terminateContract('voskhod', 'teach', ' ')).rejects.toThrow(/основание/);
  });

  it('назначение на курс: ставка преподавателя не выше плановой ставки курса, от которой считан взнос', async () => {
    const input = { teacher_username: 'teach', course_id: 'C1', period_from: '2026-09-01', period_to: '2027-06-01' } as any;
    const covered = make();
    await expect(covered.service.createAssignment('voskhod', input)).resolves.toMatchObject({ teacher_username: 'teach', status: EduAssignmentStatus.ACTIVE });
    const dear = make({ plannedRate: '900.0000 RUB' });
    await expect(dear.service.createAssignment('voskhod', input)).rejects.toThrow(/выше плановой ставки курса/);
    expect(dear.teachers.saveAssignment).not.toHaveBeenCalled();
  });

  it('назначение на курс: без договора, с отклонённым либо прекращённым договором пайщик к курсу не допускается', async () => {
    const input = { teacher_username: 'teach', course_id: 'C1', period_from: '2026-09-01', period_to: '2027-06-01' } as any;
    for (const contract of [false, EduContractStatus.DECLINED, EduContractStatus.TERMINATED] as const) {
      const { service, teachers, courses } = make({ contract, courseTeachers: [] });
      await expect(service.createAssignment('voskhod', input)).rejects.toMatchObject({ code: 'EDUBRIDGE_COURSE_TEACHERS_WITHOUT_CONTRACT' });
      expect(teachers.saveAssignment).not.toHaveBeenCalled();
      expect(courses.save).not.toHaveBeenCalled();
    }
    // Договор на подписи у председателя допуску не мешает — как в форме курса.
    const pending = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await expect(pending.service.createAssignment('voskhod', input)).resolves.toMatchObject({ status: EduAssignmentStatus.ACTIVE });
  });

  it('действующий договор повторно не подписывается — возвращается тот же', async () => {
    const { service, chain } = make();
    const c = await service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N-9', '1000.0000 RUB');
    expect(chain.signContract).not.toHaveBeenCalled();
    expect(c.contract_hash).toBe('h');
  });

  it('допуск к курсу действует сразу: документа и подписей нет, в цепь ничего не уходит', async () => {
    const { service, chain, teachers } = make();
    const a = await service.createAssignment('voskhod', { teacher_username: 'teach', course_id: 'C1', period_from: '2026-09-01', period_to: '2027-06-01' } as any);
    expect(a.status).toBe(EduAssignmentStatus.ACTIVE);
    expect(teachers.saveAssignment).toHaveBeenCalledTimes(1);
    for (const call of Object.values(chain) as jest.Mock[]) expect(call).not.toHaveBeenCalled();
    // Действий и таблицы приложения к договору у расширения больше нет.
    expect((service as any).signAnnex).toBeUndefined();
    expect((chain as any).signAnnex).toBeUndefined();
  });

  it('допущенный преподаватель попадает в список «Курс ведут»; уже стоящий в списке курс не пересохраняет', async () => {
    const input = { teacher_username: 'teach', course_id: 'C1', period_from: '2026-09-01', period_to: '2027-06-01' } as any;
    const absent = make({ courseTeachers: [] });
    await absent.service.createAssignment('voskhod', input);
    expect(absent.courses.save).toHaveBeenCalledWith(expect.objectContaining({ teacher_usernames: ['teach'] }));

    const listed = make({ courseTeachers: ['teach'] });
    await listed.service.createAssignment('voskhod', input);
    expect(listed.courses.save).not.toHaveBeenCalled();
  });

  it('снятие допуска закрывает назначение и убирает преподавателя из курса — сверка не выдаст допуск заново', async () => {
    const { service, assignment, courses } = make({ courseTeachers: ['teach', 'other'] });
    const closed = await service.closeAssignment('voskhod', 'A1');
    expect(closed.status).toBe(EduAssignmentStatus.CLOSED);
    expect(assignment.status).toBe(EduAssignmentStatus.CLOSED);
    expect(courses.save).toHaveBeenCalledWith(expect.objectContaining({ teacher_usernames: ['other'] }));
  });

  it('снятие допуска у преподавателя вне списка курса курс не трогает; несуществующее назначение — отказ', async () => {
    const { service, courses, teachers } = make({ courseTeachers: ['other'] });
    await service.closeAssignment('voskhod', 'A1');
    expect(courses.save).not.toHaveBeenCalled();
    teachers.findAssignment.mockResolvedValueOnce(null);
    await expect(service.closeAssignment('voskhod', 'NOPE')).rejects.toThrow(/Назначение не найдено/);
  });
});

/**
 * Взнос рождается отчётом о занятии: произвольной суммы у него больше нет.
 * Материалы передаются на ответственное хранение, а гарантийный срок в этих
 * случаях снимается — проверяется путь заявления в совет, а не удержание.
 */
async function contributionOfLesson(service: any, store: Map<string, any>, lessonNumber = 1) {
  const lesson = await service.reportLesson('voskhod', 'teach', {
    assignment_id: 'A1',
    lesson_number: lessonNumber,
    materials: ['https://video/1'],
    topic: 'Тема',
  });
  const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
  await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
  contribution.hold_until = null;
  return contribution;
}

describe('EdubridgeTeacherService', () => {
  it('без договора УХД взнос не подготовить', async () => {
    const { service, store } = make({ contract: false });
    await expect(contributionOfLesson(service, store)).rejects.toThrow(/договор участия/);
  });

  it('допуск к курсу снят — отчитаться по занятию и подготовить взнос нельзя', async () => {
    const { service, store } = make({ assignmentStatus: EduAssignmentStatus.CLOSED });
    await expect(contributionOfLesson(service, store)).rejects.toThrow(/Допуск к курсу снят/);
  });

  it('подача: submitrid, проект решения совета, правило отслеживания, статус SUBMITTED', async () => {
    const { service, chain, freeDecisions, tracking, store } = make();
    const c = await contributionOfLesson(service, store);
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(chain.submitRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, amount: '1000.0000 RUB' }));
    expect(freeDecisions.publishProjectOfFreeDecision).toHaveBeenCalled();
    expect(tracking.registerTrackingRule).toHaveBeenCalledWith(expect.objectContaining({ hash: 'PROJ', event_type: DecisionEventType.SOVIET_DECISION, metadata: expect.objectContaining({ rid_hash: c.rid_hash }) }));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(submitted.statement_hash).toBe('stmt');
  });

  it('решение совета → COUNCIL_APPROVED; акт преподавателя → ACT_SIGNED; тот же акт с подписью председателя → acceptrid, ACCEPTED', async () => {
    const { funds, service, chain, documents, store } = make();
    const c = await contributionOfLesson(service, store);
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
    expect(documents.generate.mock.calls.filter((x: any) => x[0].data.registry_id === R.EducationRidAct.registry_id).length).toBe(1);

    const bothSigned = { ...teacherAct, signatures: [{ signer: 'teach' }, { signer: 'ant' }] };
    const accepted = await service.acceptContribution('voskhod', 'ant', c.id, bothSigned);
    expect(chain.acceptRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, act: expect.objectContaining({ hash: 'ACT' }) }));
    expect(documents.generate.mock.calls.some((x: any) => x[0].data.registry_id === R.EducationRidDecision.registry_id && x[0].data.decision_id === 17)).toBe(true);
    // Протокол называет пайщиком преподавателя, а не председателя, и несёт вид результата.
    const protocol = documents.generate.mock.calls.find((x: any) => x[0].data.registry_id === R.EducationRidDecision.registry_id)![0].data;
    expect(protocol).toMatchObject({ username: c.teacher_username, rid_type: c.rid_type });
    // Акт ссылается на протокол совета, которым принят взнос.
    const actData = documents.generate.mock.calls.find((x: any) => x[0].data.registry_id === R.EducationRidAct.registry_id)![0].data;
    expect(actData.decision_id).toBe(17);
    expect(accepted.status).toBe(EduContributionStatus.ACCEPTED);
    // Цепь списала резерв преподавателям — обязательство по курсу уменьшается на стоимость результата.
    expect(funds.onSettled).toHaveBeenCalledWith('voskhod', 'C1', '1000.0000 RUB');
  });

  it('сбой учёта резерва приём результата не отменяет', async () => {
    const { service, funds, store } = make();
    funds.onSettled.mockRejectedValue(new Error('база недоступна'));
    const c = await contributionOfLesson(service, store);
    Object.assign(c, { status: EduContributionStatus.ACT_SIGNED, act_hash: 'act', council_decision_id: '17' });
    const act = { ...signedBy('teach', 'ACT'), signatures: [{ signer: 'teach' }, { signer: 'ant' }] };
    await expect(service.acceptContribution('voskhod', 'ant', c.id, act)).resolves.toMatchObject({ status: EduContributionStatus.ACCEPTED });
  });

  it('приём отклоняется, если на акте нет обеих подписей или хэш другой', async () => {
    const { service, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onDecisionTracked(new DecisionTrackedEvent({ matched: true, hash: 'PROJ', event_type: DecisionEventType.SOVIET_DECISION, decision_id: '1', metadata: { extension: 'edubridge', rid_hash: c.rid_hash } }));
    await service.signAct('voskhod', 'teach', c.id, signedBy('teach', 'ACT'));
    await expect(service.acceptContribution('voskhod', 'ant', c.id, signedBy('teach', 'ACT'))).rejects.toThrow(/подписи преподавателя и председателя/);
    await expect(service.acceptContribution('voskhod', 'ant', c.id, { ...signedBy('ant', 'OTHER'), signatures: [{ signer: 'teach' }, { signer: 'ant' }] })).rejects.toThrow(/хэш акта/);
  });

  it('акт до решения совета недоступен; чужое решение игнорируется', async () => {
    const { service, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onDecisionTracked(new DecisionTrackedEvent({ matched: true, hash: 'X', event_type: DecisionEventType.SOVIET_DECISION, metadata: { extension: 'market' } }));
    await expect(service.act('voskhod', 'teach', c.id)).rejects.toThrow(/после решения совета/);
  });

  it('отказ без решения совета: протокола нет, материалы снимаются с хранения с основанием', async () => {
    const { service, chain, documents, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    documents.generate.mockClear();
    const declined = await service.decline('voskhod', c.id, 'Материал не соответствует программе');
    // Отрицательного протокола у совета не бывает: собирать его не из чего.
    expect(documents.generate).not.toHaveBeenCalled();
    expect(chain.declineRid).not.toHaveBeenCalled();
    expect(chain.recallRid).toHaveBeenCalledWith(
      expect.objectContaining({ rid_hash: c.rid_hash, reason: 'совет не принял решение о приёме: Материал не соответствует программе' })
    );
    expect(declined.status).toBe(EduContributionStatus.DECLINED);
    expect(declined.decline_reason).toMatch(/не соответствует/);
  });

  it('отказ после решения совета: declinerid с протоколом этого решения', async () => {
    const { service, chain, documents, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    c.status = EduContributionStatus.COUNCIL_APPROVED;
    c.council_decision_id = '42';
    const declined = await service.decline('voskhod', c.id, 'Преподаватель отозвал результат');
    expect(documents.generate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ registry_id: R.EducationRidDecision.registry_id, decision_id: 42 }) }));
    expect(chain.declineRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash }));
    expect(chain.recallRid).not.toHaveBeenCalled();
    expect(declined.status).toBe(EduContributionStatus.DECLINED);
  });

  it('подача запоминает номер вопроса в повестке совета; отклонение и просрочка помечают заявление', async () => {
    const { service, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(c.council_agenda_id).toBe('77');

    await service.onCouncilGaveUp('voskhod', '77', EduCouncilOutcome.DECLINED);
    expect(c.council_outcome).toBe(EduCouncilOutcome.DECLINED);
    // Заявление остаётся на рассмотрении: материалы снимает председатель, а не автомат.
    expect(c.status).toBe(EduContributionStatus.SUBMITTED);
  });

  it('чужой вопрос повестки и заявление не на рассмотрении не помечаются', async () => {
    const { service, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    await service.onCouncilGaveUp('voskhod', '78', EduCouncilOutcome.EXPIRED);
    expect(c.council_outcome ?? null).toBeNull();
    c.status = EduContributionStatus.COUNCIL_APPROVED;
    await service.onCouncilGaveUp('voskhod', '77', EduCouncilOutcome.EXPIRED);
    expect(c.council_outcome ?? null).toBeNull();
  });

  it('повестка совета недоступна — подача проходит, пометки не будет', async () => {
    const { service, council, store } = make();
    council.getDecisions.mockRejectedValue(new Error('цепь не отвечает'));
    const c = await contributionOfLesson(service, store);
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(submitted.council_agenda_id).toBeNull();
  });

  it('отказ без основания не принимается', async () => {
    const { service, chain, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await expect(service.decline('voskhod', c.id, '  ')).rejects.toThrow(/основание/);
    expect(chain.recallRid).not.toHaveBeenCalled();
  });

  it('сбой на проекте решения: заявление в цепи зафиксировано, очередь доводит его до совета без повторной подачи', async () => {
    const { service, chain, freeDecisions, teachers, store } = make();
    const c = await contributionOfLesson(service, store);
    freeDecisions.publishProjectOfFreeDecision.mockRejectedValueOnce(new Error('совет недоступен'));
    await expect(service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'))).rejects.toThrow(/совет недоступен/);
    expect(c.status).toBe(EduContributionStatus.SUBMITTED);
    expect(c.statement_document).toBeTruthy();
    expect(c.council_project_hash ?? null).toBeNull();

    teachers.findSubmittedWithoutProject.mockResolvedValue([c]);
    await expect(service.publishDueContributions('voskhod')).resolves.toBe(1);
    expect(chain.submitRid).toHaveBeenCalledTimes(1);
    expect(c.council_project_hash).toBe('proj');
  });

  it('цепь отвечает «уже подано» — подача продолжается с проекта решения', async () => {
    const { service, chain, freeDecisions, store } = make();
    const c = await contributionOfLesson(service, store);
    chain.submitRid.mockRejectedValueOnce(new Error('assertion failure with message: Заявление о паевом взносе по этим материалам уже подано'));
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(freeDecisions.publishProjectOfFreeDecision).toHaveBeenCalled();
  });

  it('иная ошибка цепи при подаче статус не меняет', async () => {
    const { service, chain, store } = make();
    const c = await contributionOfLesson(service, store);
    chain.submitRid.mockRejectedValueOnce(new Error('Гарантийный срок по материалам занятия ещё идёт'));
    await expect(service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'))).rejects.toThrow(/ещё идёт/);
    expect(c.status).toBe(EduContributionStatus.HELD);
  });

  it('расчёт: сумма принятых и доступное в главном кошельке', async () => {
    const { service, store } = make();
    store.set('Z', { status: EduContributionStatus.ACCEPTED, amount: '5000.0000 RUB', decided_at: new Date('2026-03-02'), teacher_username: 'teach' });
    const s = await service.settlement('voskhod', 'teach');
    expect(s.accepted_total).toBe('5000.0000 RUB');
    expect(s.available).toBe('7000.0000 RUB');
  });
});

describe('EdubridgeTeacherService — преподаватели кооператива', () => {
  it('список собирается по договорам: имя и фотография из ядра, назначения посчитаны', async () => {
    const { service } = make();
    const [teacher] = await service.listTeachers('voskhod');
    expect(teacher).toMatchObject({
      username: 'teach',
      display_name: 'Иванов Иван Иванович',
      avatar_url: '/backend/avatar.jpg',
      contract_number: 'N1',
      contract_status: EduContractStatus.ACTIVE,
      assignments_total: 1,
      assignments_active: 1,
    });
  });

  it('закрытое назначение в число действующих не идёт', async () => {
    const { service } = make({ assignmentStatus: EduAssignmentStatus.CLOSED });
    const [teacher] = await service.listTeachers('voskhod');
    expect(teacher).toMatchObject({ assignments_total: 1, assignments_active: 0 });
  });

  it('без подписанных договоров список пуст', async () => {
    const { service } = make({ contract: false });
    await expect(service.listTeachers('voskhod')).resolves.toEqual([]);
  });

  it('пайщик без сертификата остаётся с учётным именем, фотографии может не быть', async () => {
    const { service, names, avatars } = make();
    names.displayNames.mockResolvedValueOnce(new Map());
    avatars.getAvatarUrls.mockResolvedValueOnce(new Map());
    const [teacher] = await service.listTeachers('voskhod');
    expect(teacher).toMatchObject({ display_name: '', avatar_url: null });
  });
});

describe('EdubridgeTeacherService — занятия и гарантийный срок', () => {
  const report = { assignment_id: 'A1', lesson_number: 1, materials: ['https://video/1'], topic: 'Дроби' };

  it('отчёт о занятии: взнос считается как часы по ставке, заявление держится гарантийный срок', async () => {
    const { service, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    expect(lesson.lesson_number).toBe(1);
    expect(lesson.contribution_id).toBeTruthy();
    const contribution = [...store.values()][0];
    // Час занятия при ставке 1000 ₽/ч — тысяча рублей, произвольной суммы нет.
    expect(contribution.amount).toBe('1000.0000 RUB');
    expect(contribution.hold_until).toBeInstanceOf(Date);
  });

  it('занятие вне плана курса отклоняется', async () => {
    const { service } = make({ lessonsTotal: 8 });
    await expect(service.reportLesson('voskhod', 'teach', { ...report, lesson_number: 9 } as any)).rejects.toThrow(/вне плана курса/);
  });

  it('повторный отчёт по тому же занятию отклоняется', async () => {
    const { service } = make();
    await service.reportLesson('voskhod', 'teach', report as any);
    await expect(service.reportLesson('voskhod', 'teach', report as any)).rejects.toThrow(/уже подан/);
  });

  it('передача материалов: holdrid в цепь с датой окончания срока, статус «на хранении»', async () => {
    const { service, chain, store } = make();
    // Курс ещё не активирован, гарантия 14 дней: срок считается от сегодняшнего
    // дня, дата занятия на него не влияет.
    const lesson = await service.reportLesson('voskhod', 'teach', { ...report, held_at: '2026-01-01T10:00:00Z' } as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    const held = await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const [payload] = chain.holdRid.mock.calls[0];
    expect(payload).toMatchObject({ rid_hash: contribution.rid_hash, amount: '1000.0000 RUB' });
    const until = new Date(`${payload.hold_until}Z`).getTime();
    expect(Math.abs(until - (Date.now() + 14 * 86400_000))).toBeLessThan(60_000);
    expect(held.status).toBe(EduContributionStatus.HELD);
    expect(held.storage_act_hash).toBe('hold');
  });

  it('акт хранения называет срок от дня передачи, и эта же дата уходит в цепь', async () => {
    const { service, chain, documents, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    contribution.hold_until = new Date('2026-01-01');
    await service.storageAct('voskhod', 'teach', contribution.id);
    expect(Math.abs(contribution.hold_until.getTime() - (Date.now() + 14 * 86400_000))).toBeLessThan(60_000);
    expect(documents.generate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ registry_id: R.EducationRidStorageAct.registry_id }) }));
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    expect(new Date(`${chain.holdRid.mock.calls[0][0].hold_until}Z`).getTime()).toBe(Math.floor(contribution.hold_until.getTime() / 1000) * 1000);
  });

  it('гарантийный срок — один на курс, от даты начала занятий: дата занятия и день отчёта на него не влияют', async () => {
    const startsAt = new Date(Date.now() - 3 * 86400_000);
    const { service, chain, store } = make({ startsAt });
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.storageAct('voskhod', 'teach', contribution.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const until = new Date(`${chain.holdRid.mock.calls[0][0].hold_until}Z`).getTime();
    expect(until).toBe(Math.floor((startsAt.getTime() + 14 * 86400_000) / 1000) * 1000);
  });

  it('срок курса вышел — заявление преподавателя уходит в совет сразу', async () => {
    const { service, chain, store } = make({ startsAt: new Date(Date.now() - 30 * 86400_000) });
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const submitted = await service.submitContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'STMT'));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(chain.submitRid).toHaveBeenCalled();
  });

  it('акт, сформированный давно, называет срок короче гарантийного — подписать его нельзя', async () => {
    const { service, chain, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    contribution.hold_until = new Date(Date.now() + 3 * 86400_000);
    await expect(service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'))).rejects.toThrow(/устарел/);
    expect(chain.holdRid).not.toHaveBeenCalled();
  });

  it('дата занятия в будущем и раньше периода назначения отклоняется', async () => {
    const { service } = make();
    const tomorrow = new Date(Date.now() + 86400_000).toISOString();
    await expect(service.reportLesson('voskhod', 'teach', { ...report, held_at: tomorrow } as any)).rejects.toThrow(/ещё не наступила/);
    await expect(service.reportLesson('voskhod', 'teach', { ...report, held_at: '2025-01-01T10:00:00Z' } as any)).rejects.toThrow(/раньше начала периода/);
  });

  it('занятие в отчёте не длиннее сдвоенного занятия курса', async () => {
    const { service, store } = make();
    await expect(service.reportLesson('voskhod', 'teach', { ...report, duration_minutes: 121 } as any)).rejects.toThrow(/не больше 120 мин/);
    await service.reportLesson('voskhod', 'teach', { ...report, duration_minutes: 120 } as any);
    expect([...store.values()][0].amount).toBe('2000.0000 RUB');
  });

  it('после снятия материалов с хранения занятие проводится и отчитывается заново — взнос новый', async () => {
    const { service, teachers, store } = make();
    let n = 0;
    teachers.createContribution.mockImplementation((d: any) => ({ ...d, id: `K${++n}`, created_at: new Date('2026-02-01') }));
    const first = await service.reportLesson('voskhod', 'teach', report as any);
    const firstContribution = store.get('K1');
    await service.revokeHeldContribution('voskhod', 'K1', 'Занятие не состоялось');
    const again = await service.reportLesson('voskhod', 'teach', { ...report, topic: 'Дроби, повтор' } as any);
    expect(again.id).toBe(first.id);
    expect(again.topic).toBe('Дроби, повтор');
    expect(again.contribution_id).toBe('K2');
    expect(store.get('K2').rid_hash).not.toBe(firstContribution.rid_hash);
  });

  it('отчёт задним числом и курс без гарантии: материалы всё равно принимаются на хранение', async () => {
    const { service, chain, store } = make({ guaranteeDays: 0 });
    const lesson = await service.reportLesson('voskhod', 'teach', { ...report, held_at: '2026-01-01T10:00:00Z' } as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    const held = await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    // Гарантия на курсе не объявлена: срок кончается в момент приёма.
    expect(new Date(`${chain.holdRid.mock.calls[0][0].hold_until}Z`).getTime()).toBeLessThanOrEqual(Date.now());
    expect(held.status).toBe(EduContributionStatus.HELD);

    // Срок уже истёк, поэтому заявление уходит в совет сразу.
    const submitted = await service.submitContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'STMT'));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(chain.submitRid).toHaveBeenCalled();
  });

  it('повторная передача тех же материалов отклоняется', async () => {
    const { service, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    await expect(service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD2'))).rejects.toThrow(/уже приняты на ответственное хранение/);
  });

  it('заявление без передачи материалов на хранение не принимается', async () => {
    const { service, chain, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await expect(service.submitContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'STMT'))).rejects.toThrow(/не приняты на ответственное хранение/);
    expect(chain.submitRid).not.toHaveBeenCalled();
  });

  it('пока идёт гарантийный срок, подписанное заявление в совет не уходит', async () => {
    const { service, chain, freeDecisions, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const held = await service.submitContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'STMT'));
    expect(held.status).toBe(EduContributionStatus.HELD);
    expect(chain.submitRid).not.toHaveBeenCalled();
    expect(freeDecisions.createProjectOfFreeDecision).not.toHaveBeenCalled();
  });

  it('по истечении срока очередь отправляет заявление сама, без участия преподавателя', async () => {
    const { service, chain, teachers, store } = make({ guaranteeDays: 0 });
    const lesson = await service.reportLesson('voskhod', 'teach', { ...report, held_at: '2026-01-01T10:00:00Z' } as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    contribution.status = EduContributionStatus.HELD;
    contribution.statement_document = signedBy('teach', 'STMT');
    teachers.findHeldDue = jest.fn(async () => [contribution]);
    const published = await service.publishDueContributions('voskhod');
    expect(published).toBe(1);
    expect(chain.submitRid).toHaveBeenCalled();
  });

  it('подтверждённая рекламация снимает материалы с хранения и закрывает заявление', async () => {
    const { service, chain, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const revoked = await service.revokeHeldContribution('voskhod', contribution.id, 'Запись занятия не открывается');
    expect(chain.recallRid).toHaveBeenCalledWith(
      expect.objectContaining({ rid_hash: contribution.rid_hash, reason: 'Запись занятия не открывается' })
    );
    expect(revoked.status).toBe(EduContributionStatus.DECLINED);
    expect(revoked.decline_reason).toBe('Запись занятия не открывается');
  });

  it('рекламация по материалам, которые на хранение не передавались, проводки не делает', async () => {
    const { service, chain, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    const revoked = await service.revokeHeldContribution('voskhod', contribution.id, 'Занятие не состоялось');
    expect(chain.recallRid).not.toHaveBeenCalled();
    expect(revoked.status).toBe(EduContributionStatus.DECLINED);
  });
});

describe('EdubridgeTeacherService — договор следует за таблицей цепи (ответ после дельты)', () => {
  it('дельта «active» переводит ждущий договор в действующий с датой подписи из цепи — без уведомления', async () => {
    const { service, teachers } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await service.applyContractFromChain('voskhod', 'teach', 'H', 'active', '2026-09-23T13:49:52');
    const saved = teachers.saveContract.mock.calls[0]![0];
    expect(saved.status).toBe(EduContractStatus.ACTIVE);
    expect(saved.approved_at).toEqual(new Date('2026-09-23T13:49:52Z'));
  });

  it('строка стёрта у ждущего договора — отказ; действующий договор дельтой не трогается', async () => {
    const pending = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await pending.service.applyContractFromChain('voskhod', 'teach', 'h', null, null);
    expect(pending.teachers.saveContract.mock.calls[0]![0].status).toBe(EduContractStatus.DECLINED);

    const active = make({ contract: EduContractStatus.ACTIVE });
    await active.service.applyContractFromChain('voskhod', 'teach', 'h', null, null);
    expect(active.teachers.saveContract).not.toHaveBeenCalled();
  });

  it('действие apprvcontr после дельты не перетирает дату подписи из цепи', async () => {
    const { service, teachers } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await service.applyContractFromChain('voskhod', 'teach', 'h', 'active', '2026-09-23T13:49:52');
    await service.onContractApproved('voskhod', 'teach', 'h');
    expect(teachers.saveContract.mock.calls[1]![0].approved_at).toEqual(new Date('2026-09-23T13:49:52Z'));
  });
});

describe('Профиль преподавателя — ставка за час и рассказ о себе', () => {
  it('первый шаг подключения: без договора сохраняются рассказ и названная ставка', async () => {
    const { service, teachers } = make({ contract: false });
    const saved = await service.saveProfile('voskhod', 'teach', { about: '  Преподаю математику, 12 лет в школе  ', hourly_rate: '1200.0000 RUB' });
    expect(saved).toEqual({ about: 'Преподаю математику, 12 лет в школе', hourly_rate: '1200.0000 RUB', rate_locked: false });
    expect(teachers.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ coopname: 'voskhod', teacher_username: 'teach', hourly_rate: '1200.0000 RUB' }));
  });

  it('пустой рассказ о себе не принимается — в карточке преподавателя не должно быть пусто', async () => {
    const { service, teachers } = make({ contract: false });
    await expect(service.saveProfile('voskhod', 'teach', { about: '   ', hourly_rate: '1200.0000 RUB' })).rejects.toThrow(/Расскажите о себе/);
    expect(teachers.saveProfile).not.toHaveBeenCalled();
  });

  it('без ставки и с нулевой ставкой профиль до договора не сохраняется', async () => {
    const { service, teachers } = make({ contract: false });
    await expect(service.saveProfile('voskhod', 'teach', { about: 'Учу физике' })).rejects.toThrow(/Назовите ставку/);
    await expect(service.saveProfile('voskhod', 'teach', { about: 'Учу физике', hourly_rate: '0.0000 RUB' })).rejects.toThrow(/Назовите ставку/);
    expect(teachers.saveProfile).not.toHaveBeenCalled();
  });

  it('правка рассказа без ставки оставляет ранее названную ставку', async () => {
    const { service } = make({ contract: false, profile: { about: 'Старый рассказ', hourly_rate: '900.0000 RUB' } });
    const saved = await service.saveProfile('voskhod', 'teach', { about: 'Новый рассказ' });
    expect(saved).toMatchObject({ about: 'Новый рассказ', hourly_rate: '900.0000 RUB', rate_locked: false });
  });

  it('после подписи договора ставка закреплена: рассказ правится, ставка — нет', async () => {
    const { service } = make();
    const saved = await service.saveProfile('voskhod', 'teach', { about: 'Дописал о себе' });
    expect(saved).toEqual({ about: 'Дописал о себе', hourly_rate: '1000.0000 RUB', rate_locked: true });
    await expect(service.saveProfile('voskhod', 'teach', { about: 'Дописал о себе', hourly_rate: '5000.0000 RUB' })).rejects.toThrow(/Ставка часа уже задана/);
  });

  it('прекращённый договор ставку не держит — её можно назвать заново', async () => {
    const { service } = make({ contract: EduContractStatus.TERMINATED });
    const saved = await service.saveProfile('voskhod', 'teach', { about: 'Возвращаюсь преподавать', hourly_rate: '1500.0000 RUB' });
    expect(saved).toMatchObject({ hourly_rate: '1500.0000 RUB', rate_locked: false });
  });

  it('профиль без записи: рассказ пуст, ставка — из договора либо не названа', async () => {
    await expect(make().service.profile('voskhod', 'teach')).resolves.toEqual({ about: '', hourly_rate: '1000.0000 RUB', rate_locked: true });
    await expect(make({ contract: false }).service.profile('voskhod', 'teach')).resolves.toEqual({ about: '', hourly_rate: '0.0000 RUB', rate_locked: false });
  });

  it('договор берёт ставку из профиля, когда её не передали; без ставки не подписывается', async () => {
    const named = make({ contract: false, profile: { about: 'Учу', hourly_rate: '1300.0000 RUB' } });
    const c = await named.service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N-9');
    expect(c.hourly_rate).toBe('1300.0000 RUB');
    expect(named.chain.signContract).toHaveBeenCalledTimes(1);

    const silent = make({ contract: false });
    await expect(silent.service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N-9')).rejects.toThrow(/Назовите ставку/);
    expect(silent.chain.signContract).not.toHaveBeenCalled();
  });

  it('список преподавателей у администратора несёт рассказ о себе', async () => {
    const { service } = make({ profile: { about: 'Учу алгебре', hourly_rate: '1000.0000 RUB' } });
    const [teacher] = await service.listTeachers('voskhod');
    expect(teacher!.about).toBe('Учу алгебре');
    const [silent] = await make().service.listTeachers('voskhod');
    expect(silent!.about).toBe('');
  });
});

describe('Допуски по списку «Курс ведут»', () => {
  const course = (teachers: string[]) =>
    ({ id: 'C1', title: 'Алгебра', schedule: 'Вт, Чт 17–19', teacher_usernames: teachers, starts_at: '2026-09-23', lessons_total: 64, lessons_per_month: 8, lesson_minutes: 60, planned_hourly_rate: '1000.0000 RUB' }) as any;

  it('добавленный в курс преподаватель сразу получает действующий допуск, уже допущенный — нет', async () => {
    const { service, teachers } = make({ assignmentStatus: EduAssignmentStatus.ACTIVE, courseTeachers: ['teach', 'newbie'] });

    await service.syncCourseAssignments('voskhod', course(['teach', 'newbie']));

    expect(teachers.saveAssignment).toHaveBeenCalledTimes(1);
    expect(teachers.saveAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        teacher_username: 'newbie',
        course_id: 'C1',
        status: EduAssignmentStatus.ACTIVE,
        schedule: 'Вт, Чт 17–19',
        period_from: '2026-09-23',
        period_to: '2027-05-22',
        expected_result: 'Проведение занятий курса «Алгебра» по его учебной программе',
      })
    );
  });

  it('убранный из курса: действующий допуск снимается', async () => {
    const { service, assignment, teachers } = make({ assignmentStatus: EduAssignmentStatus.ACTIVE });

    await service.syncCourseAssignments('voskhod', course([]));

    expect(assignment.status).toBe(EduAssignmentStatus.CLOSED);
    expect(teachers.saveAssignment).toHaveBeenCalledTimes(1);
  });

  it('убранный из курса: уже снятый допуск повторно не сохраняется', async () => {
    const { service, assignment, teachers } = make({ assignmentStatus: EduAssignmentStatus.CLOSED });

    await service.syncCourseAssignments('voskhod', course([]));

    expect(assignment.status).toBe(EduAssignmentStatus.CLOSED);
    expect(teachers.saveAssignment).not.toHaveBeenCalled();
  });

  it('возвращённый в курс после снятия допуска получает новый допуск', async () => {
    const { service, teachers } = make({ assignmentStatus: EduAssignmentStatus.CLOSED });

    await service.syncCourseAssignments('voskhod', course(['teach']));

    expect(teachers.saveAssignment).toHaveBeenCalledTimes(1);
    expect(teachers.saveAssignment).toHaveBeenCalledWith(expect.objectContaining({ teacher_username: 'teach', status: EduAssignmentStatus.ACTIVE }));
  });

  it('повторная сверка ничего не создаёт — идемпотентно', async () => {
    const { service, teachers } = make({ assignmentStatus: EduAssignmentStatus.ACTIVE });

    await service.syncCourseAssignments('voskhod', course(['teach']));

    expect(teachers.saveAssignment).not.toHaveBeenCalled();
  });

  it('период — от начала занятий на весь срок программы; без даты — от сегодня', () => {
    expect(coursePeriod({ starts_at: '2026-09-23', lessons_total: 64, lessons_per_month: 8 } as any)).toEqual({ from: '2026-09-23', to: '2027-05-22' });
    expect(coursePeriod({ starts_at: '2026-01-31', lessons_total: 5, lessons_per_month: 8 } as any)).toEqual({ from: '2026-01-31', to: '2026-02-27' });
    expect(coursePeriod({ starts_at: null, lessons_total: 8, lessons_per_month: 8 } as any).from).toBe(new Date().toISOString().slice(0, 10));
  });

  it('ставка преподавателя выше плановой ставки курса — отказ с объяснением; не выше — пусто', () => {
    expect(rateCoverageError('1200.0000 RUB', '1000.0000 RUB')?.message).toContain('выше плановой ставки курса');
    expect(rateCoverageError('1000.0000 RUB', '1000.0000 RUB')).toBeNull();
    expect(rateCoverageError(undefined, '1000.0000 RUB')).toBeNull();
  });
});

describe('EduAssignmentDTO — назначение в ответе API', () => {
  const course = { title: 'Алгебра', description: 'Про уравнения', syllabus: '1. Линейные уравнения' };
  const entity = { id: 'A1', teacher_username: 'teach', course_id: 'C1', schedule: 'Вт', expected_result: 'Занятия', period_from: '2026-09-23', period_to: '2027-05-22', minutes_per_month: 480, status: EduAssignmentStatus.ACTIVE, created_at: new Date('2026-09-23') } as any;

  it('назначение — рабочий допуск: полей приложения к договору в ответе нет', () => {
    const dto = new EduAssignmentDTO(entity, course) as unknown as Record<string, unknown>;
    expect(dto).not.toHaveProperty('annex_hash');
    expect(dto).not.toHaveProperty('decline_reason');
  });

  it('обязательные поля схемы назначения заполнены', () => {
    const dto = new EduAssignmentDTO(entity, course) as unknown as Record<string, unknown>;
    for (const field of ['id', 'teacher_username', 'course_id', 'course_title', 'course_description', 'course_syllabus', 'schedule', 'expected_result', 'period_from', 'period_to', 'minutes_per_month', 'status', 'created_at']) {
      expect(dto[field]).not.toBeUndefined();
    }
  });

  it('программа и описание курса — в назначении: преподаватель читает их на своём столе; курса нет — пусто', () => {
    const dto = new EduAssignmentDTO(entity, course);
    expect(dto.course_title).toBe('Алгебра');
    expect(dto.course_syllabus).toBe('1. Линейные уравнения');
    expect(dto.course_description).toBe('Про уравнения');
    const orphan = new EduAssignmentDTO(entity, null);
    expect([orphan.course_title, orphan.course_syllabus, orphan.course_description]).toEqual(['', '', '']);
  });
});


describe('EdubridgeTeacherService — документ договора для просмотра', () => {
  const approved = { hash: 'h', meta: {}, signatures: [{ signer: 'teach' }, { signer: 'chair' }] } as any;

  it('подпись председателя кладёт в запись документ с двумя подписями', async () => {
    const { service, teachers } = make({ contract: EduContractStatus.ACTIVE });
    await service.saveApprovedContractDocument('voskhod', 'teach', 'H', approved);
    expect(teachers.saveContract.mock.calls[0]![0].contract_document).toBe(approved);
  });

  it('документ чужого договора и пустой документ запись не меняют', async () => {
    const { service, teachers } = make({ contract: EduContractStatus.ACTIVE });
    await service.saveApprovedContractDocument('voskhod', 'teach', 'другой', approved);
    await service.saveApprovedContractDocument('voskhod', 'teach', 'h', undefined);
    expect(teachers.saveContract).not.toHaveBeenCalled();
  });

  it('у договора без сохранённого документа просмотр отдаёт пусто, без обращения к реестру', async () => {
    const { service, documents } = make({ contract: EduContractStatus.ACTIVE });
    await expect(service.contractDocument('voskhod', 'teach')).resolves.toBeNull();
    expect(documents.buildAggregate).not.toHaveBeenCalled();
  });
});
