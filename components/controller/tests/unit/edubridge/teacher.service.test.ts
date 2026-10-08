/** Преподавательский контур: ДУХД и приложение двухподписные через одобрение председателя, взнос РИД, решение совета повесткой контракта, акт → acceptrid, отклонение. */
import { EdubridgeTeacherService, coursePeriod, rateCoverageError } from '~/extensions/edubridge/application/services/edubridge-teacher.service';
import { EduAssignmentStatus, EduContractStatus, EduContributionStatus, EduCouncilOutcome } from '~/extensions/edubridge/domain/enums';
import { Cooperative } from 'cooptypes';
import { EduAssignmentDTO } from '~/extensions/edubridge/application/dto/edu-teacher.dto';

const R = Cooperative.Registry;

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB', rootGovernPrecision: 4 } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const signedBy = (signer: string, hash = 'ABC') => ({ hash, doc_hash: hash, meta_hash: hash, version: '1.0', meta: {}, signatures: [{ signer }] }) as any;

function make(
  opts: { learners?: number; lessonAmount?: string; contract?: boolean | EduContractStatus; assignmentStatus?: EduAssignmentStatus; lessonsTotal?: number; guaranteeDays?: number; plannedRate?: string; startsAt?: Date | null; courseTeachers?: string[]; profile?: { about: string; hourly_rate: string } | null } = {}
) {
  const assignment = { id: 'A1', coopname: 'voskhod', teacher_username: 'teach', course_id: 'C1', status: opts.assignmentStatus ?? EduAssignmentStatus.ACTIVE, period_from: '2025-09-01', period_to: '2027-06-01', created_at: new Date('2026-01-01') } as any;
  const store = new Map<string, any>();
  const returns = new Map<string, any>();
  const contractState: { current: any } = {
    current: opts.contract === false ? null : { coopname: 'voskhod', teacher_username: 'teach', contract_hash: 'h', contract_number: 'N1', hourly_rate: '1000.0000 RUB', status: typeof opts.contract === 'string' ? opts.contract : EduContractStatus.ACTIVE, decline_reason: '', approved_at: null },
  };
  const profileState: { current: any } = { current: opts.profile ? { coopname: 'voskhod', teacher_username: 'teach', ...opts.profile } : null };
  const teachers = {
    findContract: jest.fn(async () => contractState.current),
    findContractByHash: jest.fn(async (_c: string, hash: string) =>
      contractState.current && String(contractState.current.contract_hash).toLowerCase() === hash.toLowerCase() ? contractState.current : null
    ),
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
    findContributionByActHash: jest.fn(async (_c: string, h: string) => [...store.values()].find((c) => c.act_hash === h) ?? null),
    listShareReturns: jest.fn(async () => [...returns.values()]),
    findShareReturn: jest.fn(async (_c: string, id: string) => returns.get(id) ?? null),
    saveShareReturn: jest.fn(async (r: any) => { const saved = { ...r, id: 'R1', created_at: new Date('2026-10-07') }; returns.set('R1', saved); return saved; }),
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
    findByCourse: jest.fn(async () => [...lessonStore.values()]),
    // Порядок и номера занятий ведутся внутри группы.
    findByGroup: jest.fn(async () => [...lessonStore.values()]),
    findByGroupNumber: jest.fn(async (_c: string, _g: string, n: number) => lessonStore.get(n) ?? null),
    findById: jest.fn(async (_c: string, id: string) => [...lessonStore.values()].find((l) => l.id === id) ?? null),
    create: jest.fn((d: any) => ({ id: `LS${d.lesson_number}`, ...d })),
    save: jest.fn(async (l: any) => { lessonStore.set(l.lesson_number, l); return l; }),
  } as any;
  const lessonOpen = { current: false };
  const chain = {
    holdRid: jest.fn(async () => ({})), recallRid: jest.fn(async () => ({})),
    submitRid: jest.fn(async () => ({})), acceptRid: jest.fn(async () => ({})), declineRid: jest.fn(async () => ({})), signRidAct: jest.fn(async () => ({})),
    signContract: jest.fn(async () => ({})), terminateContract: jest.fn(async () => ({})),
    withdrawShare: jest.fn(async () => ({})),
    // Расчёт занятия ведёт контракт: число участников и сумму приложение читает из записи занятия.
    openLesson: jest.fn(async () => { lessonOpen.current = true; return {}; }),
    chargeLesson: jest.fn(async () => ({})),
    dropLesson: jest.fn(async () => { lessonOpen.current = false; return {}; }),
    readLesson: jest.fn(async () => (lessonOpen.current ? { learners: opts.learners ?? 1, amount: opts.lessonAmount ?? '1000.0000 RUB' } : null)),
  } as any;
  const chainTerms = { pushAssignment: jest.fn(async () => undefined), tryPushAssignment: jest.fn(async () => undefined), dropAssignment: jest.fn(async () => undefined), tryPushCourse: jest.fn(async () => true) } as any;
  // Одна действующая подписка курса, оплаченная на год вперёд.
  const subscriptions = [{ id: 'E1', sub_hash: 'sub1', status: 'active', paid_until: new Date(Date.now() + 365 * 86400_000) }];
  const enrollments = { findByCourse: jest.fn(async () => subscriptions), findByGroup: jest.fn(async () => subscriptions) } as any;
  const documents = {
    generate: jest.fn(async (r: any) => ({ hash: `H${r.data.registry_id}`, html: '', full_title: '', binary: '', meta: {} })),
    buildAggregate: jest.fn(async (d: any) => ({ hash: d.hash, document: d, rawDocument: { hash: d.hash, html: '', meta: {} } })),
  } as any;
  // Повестку ставит контракт с hash = rid_hash: вопрос находится по хэшу материалов.
  const council = { getDecisions: jest.fn(async () => [...store.values()].map((c: any) => ({ id: 77, hash: c.rid_hash }))) } as any;
  // Паевой взнос по программе и главный паевой — разные кошельки с разными остатками.
  const balances: Record<string, string> = { 'w.edu.share': '3000.0000 RUB', 'w.wal.share': '7000.0000 RUB' };
  const wallets = { findByWalletAndUsername: jest.fn(async (_c: string, wallet: string) => (balances[wallet] ? { available: balances[wallet] } : null)) } as any;
  // Имя и фотография приходят из ядра портами — расширение своей копии не держит.
  const avatars = { getAvatarUrl: jest.fn(async () => null), getAvatarUrls: jest.fn(async () => new Map([['teach', '/backend/avatar.jpg']])) } as any;
  const names = { displayName: jest.fn(async () => 'Иванов Иван Иванович'), displayNames: jest.fn(async () => new Map([['teach', 'Иванов Иван Иванович']])) } as any;
  // Сверка записей с цепью после закрытия срока и приёма результата — отдельный сервис.
  const funds = { onSettled: jest.fn(async () => undefined), unlockDue: jest.fn(async () => 0) } as any;
  const events = { emit: jest.fn() } as any;
  // Данные пайщика: сюда пишутся номер и дата договора для документов преподавателя.
  const udata = { save: jest.fn(async () => undefined), get: jest.fn(async () => null) } as any;
  const walletWithdraw = { createWithdraw: jest.fn(async () => ({ withdraw_hash: 'WH' })) } as any;
  const service = new EdubridgeTeacherService(teachers, courses, lessons, chain, documents, council, wallets, avatars, names, funds, udata, logger, events, walletWithdraw, chainTerms, enrollments, { viewOf: (c: any) => c, courseOf: jest.fn(async (...a: any[]) => (courses as any).findById(a[0], a[1])), openFor: jest.fn(async () => ({ id: 'G1', chain_ref: '3', course_id: 'C1' })), get: jest.fn(async () => ({ id: 'G1', chain_ref: '3', course_id: 'C1' })), list: jest.fn(async () => [{ id: 'G1', chain_ref: '7', course_id: 'C1', status: 'active', starts_at: null, teacher_reserve_balance: null, teacher_settled_total: null }]), firstOf: jest.fn(async () => ({ id: 'G1', chain_ref: '7', course_id: 'C1', status: 'active' })), saveFunds: jest.fn(async (g: any, r: string, st: string) => { g.teacher_reserve_balance = r; g.teacher_settled_total = st; return true; }) } as any);
  return { chainTerms, enrollments, udata, service, teachers, courses, chain, documents, council, funds, store, assignment, avatars, names, lessons, wallets, balances, walletWithdraw, returns };
}


describe('EdubridgeTeacherService — договор УХД и приложение через одобрение председателя', () => {
  it('подпись договора преподавателем: signcontract в цепь, статус «ждёт подписи председателя»', async () => {
    const { service, chain } = make({ contract: false });
    const c = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT'), 'N-1');
    expect(chain.signContract).toHaveBeenCalledWith(expect.objectContaining({ username: 'teach', contract_hash: 'CONTRACT' }));
    expect(c.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(c.contract_hash).toBe('contract');
    // Ставку преподаватель себе не называет: её назначает администратор.
    expect(c.hourly_rate).toBe('0.0000 RUB');
  });

  it('договор без подписи преподавателя не уходит в цепь', async () => {
    const { service, chain } = make({ contract: false });
    await expect(service.signContract('voskhod', 'teach', signedBy('someone', 'X'), 'N')).rejects.toThrow(/не подписан преподавателем/);
    expect(chain.signContract).not.toHaveBeenCalled();
  });

  it('пока договор ждёт председателя — отчёт по занятию и взнос недоступны, хотя допуск к курсу уже есть', async () => {
    const { service, store } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await expect(contributionOfLesson(service, store)).rejects.toThrow(/ещё не подписан председателем/);
  });

  it('коллбэк совета apprvcontr делает договор действующим; dclinecontr — отклонённым с причиной, и его можно подписать заново', async () => {
    const { service, chain } = make({ contract: EduContractStatus.PENDING_APPROVAL });
    await service.onContractApproved('voskhod', 'H');
    expect((await service.contract('voskhod', 'teach'))!.status).toBe(EduContractStatus.ACTIVE);

    await service.onContractDeclined('voskhod', 'H', 'Нет квалификации');
    const declined = (await service.contract('voskhod', 'teach'))!;
    expect(declined.status).toBe(EduContractStatus.DECLINED);
    expect(declined.decline_reason).toBe('Нет квалификации');

    const again = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT2'), 'N-2');
    expect(chain.signContract).toHaveBeenCalledTimes(1);
    expect(again.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(again.contract_hash).toBe('contract2');
  });

  it('отклонённый договор подписывается заново с назначенной администратором ставкой', async () => {
    const { service } = make();
    await service.onContractDeclined('voskhod', 'H', 'Нет квалификации');
    const again = await service.signContract('voskhod', 'teach', signedBy('teach', 'CONTRACT3'), 'N-3');
    expect(again.hourly_rate).toBe('1000.0000 RUB');
  });

  it('преподаватель без назначенной ставки к курсу не допускается', async () => {
    const { service, teachers } = make();
    (await service.contract('voskhod', 'teach'))!.hourly_rate = '0.0000 RUB';
    const input = { teacher_username: 'teach', course_id: 'C1', period_from: '2026-09-01', period_to: '2027-06-01' } as any;
    await expect(service.createAssignment('voskhod', input)).rejects.toMatchObject({ code: 'EDUBRIDGE_TEACHER_RATE_NOT_ASSIGNED' });
    // Ставка на курсе, названная в допуске, договорную не заменяет.
    await expect(service.createAssignment('voskhod', { ...input, hourly_rate: '700.0000 RUB' })).rejects.toMatchObject({ code: 'EDUBRIDGE_TEACHER_RATE_NOT_ASSIGNED' });
    expect(teachers.saveAssignment).not.toHaveBeenCalled();
  });

  it('прекращение договора: termcontract в цепь, статус «прекращён», подписывается заново — ставку назначают заново', async () => {
    const { service, chain, teachers } = make();
    teachers.listAssignments.mockResolvedValue([]);
    const terminated = await service.terminateContract('voskhod', 'teach', 'выход преподавателя из кооператива');
    expect(chain.terminateContract).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'teach', contract_hash: 'h', reason: 'выход преподавателя из кооператива' });
    expect(terminated?.status).toBe(EduContractStatus.TERMINATED);
    await expect(service.reportLesson('voskhod', 'teach', { assignment_id: 'A1', lesson_number: 1, materials: ['x'] } as any)).rejects.toThrow(/прекращён/);

    const again = await service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N2');
    expect(chain.signContract).toHaveBeenCalled();
    expect(again.status).toBe(EduContractStatus.PENDING_APPROVAL);
    expect(again.hourly_rate).toBe('0.0000 RUB');
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

  it('подпись договора пишет его номер и дату в данные пайщика — документы преподавателя берут их оттуда', async () => {
    const { service, udata } = make({ contract: false, profile: { about: 'Учу', hourly_rate: '1000.0000 RUB' } });
    const doc = { ...signedBy('teach', 'CONTRACT'), meta: { contract_created_at: '06.10.2026' } };
    await service.signContract('voskhod', 'teach', doc as any, 'N-77');
    expect(udata.save).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'teach', key: 'education_contract_number', value: 'N-77' });
    expect(udata.save).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'teach', key: 'education_contract_created_at', value: '06.10.2026' });
  });

  it('назначение на курс: ставка на курсе — из договора, но не выше плановой; названная выше плановой — отказ', async () => {
    const input = { teacher_username: 'teach', course_id: 'C1', period_from: '2026-09-01', period_to: '2027-06-01' } as any;
    const covered = make();
    await expect(covered.service.createAssignment('voskhod', input)).resolves.toMatchObject({ teacher_username: 'teach', status: EduAssignmentStatus.ACTIVE, hourly_rate: '1000.0000 RUB' });
    // В договоре 1000, плановая ставка курса 900: на этом курсе преподаватель ведёт занятия за 900.
    const dear = make({ plannedRate: '900.0000 RUB' });
    await expect(dear.service.createAssignment('voskhod', input)).resolves.toMatchObject({ hourly_rate: '900.0000 RUB' });
    // Администратор называет ставку ниже договорной — она и действует.
    await expect(make().service.createAssignment('voskhod', { ...input, hourly_rate: '700.0000 RUB' })).resolves.toMatchObject({ hourly_rate: '700.0000 RUB' });
    const above = make({ plannedRate: '900.0000 RUB' });
    await expect(above.service.createAssignment('voskhod', { ...input, hourly_rate: '950.0000 RUB' })).rejects.toThrow(/выше плановой ставки курса/);
    expect(above.teachers.saveAssignment).not.toHaveBeenCalled();
  });

  it('занятия курса отчитываются по порядку: без передачи материалов по предыдущему и с датой раньше него отчёт не принимается', async () => {
    const { service, store } = make();
    const first = { assignment_id: 'A1', lesson_number: 1, materials: ['https://video/1'], topic: 'Тема', held_at: '2026-03-10T10:00:00Z' } as any;
    const lesson = await service.reportLesson('voskhod', 'teach', first);
    // Материалы первого занятия не переданы — расчёт по нему в цепи не закрыт.
    await expect(service.reportLesson('voskhod', 'teach', { ...first, lesson_number: 2 })).rejects.toMatchObject({ code: 'EDUBRIDGE_LESSON_PREVIOUS_NOT_CLOSED' });
    [...store.values()].find((c) => c.lesson_id === lesson.id).status = EduContributionStatus.HELD;
    await expect(service.reportLesson('voskhod', 'teach', { ...first, lesson_number: 2, held_at: '2026-03-01T10:00:00Z' })).rejects.toMatchObject({ code: 'EDUBRIDGE_LESSON_DATE_BEFORE_PREVIOUS' });
  });

  it('взнос за занятие считает контракт: расчёт по каждой подписке, сумма и число участников — из цепи', async () => {
    const report = { assignment_id: 'A1', lesson_number: 1, materials: ['https://video/1'], topic: 'Тема' } as any;
    const group = make({ learners: 3, lessonAmount: '900.0000 RUB' });
    const lesson = await group.service.reportLesson('voskhod', 'teach', report);
    // Допуск со ставкой — в цепь перед занятием, затем отчёт и расчёт по подписке.
    expect(group.chainTerms.pushAssignment).toHaveBeenCalled();
    expect(group.chain.openLesson).toHaveBeenCalledWith(expect.objectContaining({ username: 'teach' }));
    expect(group.chain.openLesson.mock.calls[0][0].amount).toBeUndefined();
    expect(group.chain.chargeLesson).toHaveBeenCalledWith(expect.objectContaining({ sub_hash: 'sub1' }));
    expect([...group.store.values()].find((c) => c.lesson_id === lesson.id).amount).toBe('900.0000 RUB');
    expect(lesson.learners_count).toBe(3);
    // Участников с оплаченным доступом нет — отчёт отзывается, занятие учениками не оплачено.
    const empty = make({ learners: 0, lessonAmount: '0.0000 RUB' });
    await expect(empty.service.reportLesson('voskhod', 'teach', report)).rejects.toMatchObject({ code: 'EDUBRIDGE_LESSON_NOT_PAID_BY_LEARNERS' });
    expect(empty.chain.dropLesson).toHaveBeenCalled();
  });

  it('ставка на курсе правится в пределах плановой; взнос за занятие считается по ней', async () => {
    const { service, teachers } = make();
    await expect(service.setAssignmentRate('voskhod', 'A1', '1200.0000 RUB')).rejects.toThrow(/выше плановой ставки курса/);
    await expect(service.setAssignmentRate('voskhod', 'A1', '0.0000 RUB')).rejects.toMatchObject({ code: 'EDUBRIDGE_TEACHER_RATE_REQUIRED' });
    expect(teachers.saveAssignment).not.toHaveBeenCalled();
    await expect(service.setAssignmentRate('voskhod', 'A1', '800.0000 RUB')).resolves.toMatchObject({ hourly_rate: '800.0000 RUB' });
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
    const c = await service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N-9');
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

  it('подача: submitrid в цепь (повестку ставит контракт), номер вопроса из повестки по хэшу материалов, статус SUBMITTED', async () => {
    const { service, chain, council, store } = make();
    const c = await contributionOfLesson(service, store);
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(chain.submitRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, amount: '1000.0000 RUB', statement: expect.objectContaining({ hash: 'STMT' }) }));
    expect(council.getDecisions).toHaveBeenCalledWith('voskhod');
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(submitted.statement_hash).toBe('stmt');
    expect(submitted.council_agenda_id).toBe('77');
  });

  it('решение совета (onridauth с протоколом) → COUNCIL_APPROVED; акт преподавателя → signridact с тем же протоколом, ACT_SIGNED; подпись председателя в одобрении (apprvridact) → ACCEPTED', async () => {
    const { funds, service, chain, documents, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    // Протокол 3009 подписал председатель — он приходит обратным вызовом контракта, с номером решения в метаданных.
    await service.onCouncilApproved('voskhod', c.rid_hash, { ...signedBy('ant', 'PROTO'), meta: { decision_id: 17 } } as any);
    const approved = await service.listContributions('voskhod', 'teach');
    expect(approved[0]!.status).toBe(EduContributionStatus.COUNCIL_APPROVED);
    expect(approved[0]!.council_decision_id).toBe('17');
    expect(approved[0]!.decision_hash).toBe('proto');

    await expect(service.act('voskhod', 'teach', c.id)).resolves.toBeTruthy();
    const teacherAct = signedBy('teach', 'ACT');
    const signedByTeacher = await service.signAct('voskhod', 'teach', c.id, teacherAct);
    expect(signedByTeacher.status).toBe(EduContributionStatus.ACT_SIGNED);
    // В цепь уходят протокол, подписанный советом, и акт с первой подписью — вторую ставит председатель в одобрении.
    expect(chain.signRidAct).toHaveBeenCalledWith(expect.objectContaining({ username: 'teach', rid_hash: c.rid_hash, decision: expect.objectContaining({ hash: 'PROTO' }), act: expect.objectContaining({ hash: 'ACT' }) }));
    expect(chain.acceptRid).not.toHaveBeenCalled();
    expect(documents.generate.mock.calls.some((x: any) => x[0].data.registry_id === R.EducationRidDecision.registry_id)).toBe(false);
    // Акт ссылается на протокол совета, которым принят взнос.
    const actData = documents.generate.mock.calls.find((x: any) => x[0].data.registry_id === R.EducationRidAct.registry_id)![0].data;
    expect(actData.decision_id).toBe(17);
    // До второй подписи резерв курса доводится до текущего состояния — приём по одобрению не ждёт прохода очереди.
    expect(funds.unlockDue).toHaveBeenCalledWith('voskhod', expect.any(Date), 'C1');

    // Председатель подписал акт в запросах одобрений — контракт принял результат и вызвал apprvridact.
    const bothSigned = { ...teacherAct, signatures: [{ signer: 'teach' }, { signer: 'ant' }] };
    await service.onActApproved('voskhod', c.rid_hash, bothSigned);
    expect(c.status).toBe(EduContributionStatus.ACCEPTED);
    expect((c.act_signed as any).signatures).toHaveLength(2);
    // Цепь списала резерв преподавателям — обязательство по курсу уменьшается на стоимость результата.
    expect(funds.onSettled).toHaveBeenCalledWith('voskhod', 'C1');
  });

  it('сбой учёта резерва приём результата не отменяет; у взноса без сохранённого протокола он собирается по номеру решения', async () => {
    const { service, funds, documents, chain, store } = make();
    funds.onSettled.mockRejectedValue(new Error('база недоступна'));
    const c = await contributionOfLesson(service, store);
    Object.assign(c, { status: EduContributionStatus.COUNCIL_APPROVED, council_decision_id: '17' });
    await service.signAct('voskhod', 'teach', c.id, signedBy('teach', 'ACT'));
    // Протокол называет пайщиком преподавателя, а не председателя, и несёт вид результата.
    const protocol = documents.generate.mock.calls.find((x: any) => x[0].data.registry_id === R.EducationRidDecision.registry_id)![0].data;
    expect(protocol).toMatchObject({ username: c.teacher_username, rid_type: c.rid_type, decision_id: 17 });
    expect(chain.signRidAct).toHaveBeenCalledWith(expect.objectContaining({ decision: expect.objectContaining({ hash: `H${R.EducationRidDecision.registry_id}` }) }));
    await service.onActApproved('voskhod', c.rid_hash, { ...signedBy('teach', 'ACT'), signatures: [{ signer: 'teach' }, { signer: 'ant' }] });
    expect(c.status).toBe(EduContributionStatus.ACCEPTED);
  });

  it('акт без подписи преподавателя в цепь не уходит; одобрение по взносу не на подписи игнорируется; отказ председателя закрывает заявление', async () => {
    const { service, chain, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onCouncilApproved('voskhod', c.rid_hash, { ...signedBy('ant', 'PROTO'), meta: { decision_id: 1 } } as any);
    await expect(service.signAct('voskhod', 'teach', c.id, signedBy('ant', 'ACT'))).rejects.toThrow(/не подписан преподавателем/);
    expect(chain.signRidAct).not.toHaveBeenCalled();
    await service.onActApproved('voskhod', c.rid_hash, signedBy('ant', 'ACT'));
    expect(c.status).toBe(EduContributionStatus.COUNCIL_APPROVED);

    await service.signAct('voskhod', 'teach', c.id, signedBy('teach', 'ACT'));
    await service.onActDeclined('voskhod', c.rid_hash, 'Акт расходится с материалами');
    expect(c.status).toBe(EduContributionStatus.DECLINED);
    expect(c.decline_reason).toBe('Акт расходится с материалами');
    // Решение совета есть — заявление закрывается его протоколом.
    expect(chain.declineRid).toHaveBeenCalledWith(expect.objectContaining({ rid_hash: c.rid_hash, decision: expect.objectContaining({ hash: 'PROTO' }) }));
  });

  it('акт до решения совета недоступен; решение по чужим материалам игнорируется', async () => {
    const { service, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onCouncilApproved('voskhod', 'x', signedBy('ant', 'PROTO'));
    await expect(service.act('voskhod', 'teach', c.id)).rejects.toThrow(/после решения совета/);
  });

  it('отказ совета обратным вызовом контракта помечает заявление исходом; материалы ждут снятия', async () => {
    const { service, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    await service.onCouncilDeclinedByHash('voskhod', c.rid_hash);
    expect(c.status).toBe(EduContributionStatus.SUBMITTED);
    expect(c.council_outcome).toBe(EduCouncilOutcome.DECLINED);
  });

  it('отказ без решения совета не оформляется; совет отклонил вопрос — материалы снимаются с хранения с основанием', async () => {
    const { service, chain, documents, store } = make();
    const c = await contributionOfLesson(service, store);
    await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach'));
    documents.generate.mockClear();
    // Совет заявление ещё не рассмотрел: в одиночку администратор преподавателю не отказывает.
    await expect(service.decline('voskhod', c.id, 'Материал не соответствует программе')).rejects.toMatchObject({ code: 'EDUBRIDGE_CONTRIBUTION_DECLINE_REQUIRES_COUNCIL' });
    expect(chain.recallRid).not.toHaveBeenCalled();
    expect(c.status).toBe(EduContributionStatus.SUBMITTED);

    c.council_outcome = EduCouncilOutcome.DECLINED;
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

  it('повестка ещё не прочитана: заявление в цепи зафиксировано, номер вопроса допишет очередь без повторной подачи', async () => {
    const { service, chain, council, teachers, store } = make();
    const c = await contributionOfLesson(service, store);
    council.getDecisions.mockResolvedValueOnce([]);
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(c.statement_document).toBeTruthy();
    expect(c.council_agenda_id ?? null).toBeNull();

    teachers.findSubmittedWithoutProject.mockResolvedValue([c]);
    await expect(service.publishDueContributions('voskhod')).resolves.toBe(1);
    expect(chain.submitRid).toHaveBeenCalledTimes(1);
    expect(c.council_agenda_id).toBe('77');
  });

  it('цепь отвечает «уже подано» — подача продолжается с поиска вопроса в повестке', async () => {
    const { service, chain, store } = make();
    const c = await contributionOfLesson(service, store);
    chain.submitRid.mockRejectedValueOnce(new Error('assertion failure with message: EDUBRIDGE_RID_STATEMENT_ALREADY_SUBMITTED: Заявление о паевом взносе по этим материалам уже подано'));
    const submitted = await service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'));
    expect(submitted.status).toBe(EduContributionStatus.SUBMITTED);
    expect(submitted.council_agenda_id).toBe('77');
  });

  it('иная ошибка цепи при подаче статус не меняет', async () => {
    const { service, chain, store } = make();
    const c = await contributionOfLesson(service, store);
    chain.submitRid.mockRejectedValueOnce(new Error('Гарантийный срок по материалам занятия ещё идёт'));
    await expect(service.submitContribution('voskhod', 'teach', c.id, signedBy('teach', 'STMT'))).rejects.toThrow(/ещё идёт/);
    expect(c.status).toBe(EduContributionStatus.HELD);
  });

  it('расчёт: сумма принятых, паевой взнос по программе и доступное в главном кошельке', async () => {
    const { service, store } = make();
    store.set('Z', { status: EduContributionStatus.ACCEPTED, amount: '5000.0000 RUB', decided_at: new Date('2026-03-02'), teacher_username: 'teach' });
    const s = await service.settlement('voskhod', 'teach');
    expect(s.accepted_total).toBe('5000.0000 RUB');
    expect(s.program_share).toBe('3000.0000 RUB');
    expect(s.available).toBe('7000.0000 RUB');
  });

  it('расчёт: кошелька программы у преподавателя ещё нет — паевой взнос по программе нулевой', async () => {
    const { service, balances } = make();
    delete balances['w.edu.share'];
    expect((await service.settlement('voskhod', 'teach')).program_share).toBe('0.0000 RUB');
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

  it('передача материалов: holdrid в цепь без суммы и срока, статус «на хранении»', async () => {
    const { service, chain, store } = make();
    // Курс ещё не активирован, гарантия 14 дней: срок считается от сегодняшнего
    // дня, дата занятия на него не влияет.
    const lesson = await service.reportLesson('voskhod', 'teach', { ...report, held_at: '2026-01-01T10:00:00Z' } as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    const held = await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const [payload] = chain.holdRid.mock.calls[0];
    // Сумму и срок хранения контракт берёт из записи занятия — в действии их нет.
    expect(payload).toMatchObject({ rid_hash: contribution.rid_hash, username: 'teach' });
    expect(payload.amount).toBeUndefined();
    expect(payload.hold_until).toBeUndefined();
    expect(held.status).toBe(EduContributionStatus.HELD);
    expect(held.storage_act_hash).toBe('hold');
  });

  it('акт хранения называет срок от дня передачи', async () => {
    const { service, chain, documents, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    contribution.hold_until = new Date('2026-01-01');
    await service.storageAct('voskhod', 'teach', contribution.id);
    expect(Math.abs(contribution.hold_until.getTime() - (Date.now() + 14 * 86400_000))).toBeLessThan(60_000);
    expect(documents.generate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ registry_id: R.EducationRidStorageAct.registry_id }) }));
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    expect(chain.holdRid).toHaveBeenCalledTimes(1);
  });

  it('гарантийный срок — один на курс, от даты начала занятий: дата занятия и день отчёта на него не влияют', async () => {
    const startsAt = new Date(Date.now() - 3 * 86400_000);
    const { service, chain, store } = make({ startsAt });
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.storageAct('voskhod', 'teach', contribution.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    expect(chain.holdRid).toHaveBeenCalledTimes(1);
    expect(Math.abs(contribution.hold_until.getTime() - (startsAt.getTime() + 14 * 86400_000))).toBeLessThan(1000);
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

  it('занятие всегда длиной по курсу: длительность в отчёте не называется и в цепь не уходит', async () => {
    const { service, store, chain } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    expect(lesson.duration_minutes).toBe(60);
    expect(chain.openLesson.mock.calls[0][0]).not.toHaveProperty('minutes');
    expect(store.size).toBe(1);
  });

  it('после отказа совета занятие проводится и отчитывается заново — взнос новый', async () => {
    const { service, teachers, store } = make();
    let n = 0;
    teachers.createContribution.mockImplementation((d: any) => ({ ...d, id: `K${++n}`, created_at: new Date('2026-02-01') }));
    const first = await service.reportLesson('voskhod', 'teach', report as any);
    const firstContribution = store.get('K1');
    // Совет отклонил вопрос о приёме — председатель оформил отказ, материалы сняты с хранения.
    firstContribution.status = EduContributionStatus.SUBMITTED;
    firstContribution.council_outcome = EduCouncilOutcome.DECLINED;
    await service.decline('voskhod', 'K1', 'Совет отклонил вопрос');
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
    expect(chain.holdRid).toHaveBeenCalledTimes(1);
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
    const { service, chain, council, store } = make();
    const lesson = await service.reportLesson('voskhod', 'teach', report as any);
    const contribution = [...store.values()].find((c) => c.lesson_id === lesson.id);
    await service.holdContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'HOLD'));
    const held = await service.submitContribution('voskhod', 'teach', contribution.id, signedBy('teach', 'STMT'));
    expect(held.status).toBe(EduContributionStatus.HELD);
    expect(chain.submitRid).not.toHaveBeenCalled();
    expect(council.getDecisions).not.toHaveBeenCalled();
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
    await service.onContractApproved('voskhod', 'h');
    expect(teachers.saveContract.mock.calls[1]![0].approved_at).toEqual(new Date('2026-09-23T13:49:52Z'));
  });
});

describe('Профиль преподавателя — рассказ о себе; ставку назначает администратор', () => {
  it('первый шаг подключения: без договора сохраняется рассказ, ставка преподавателем не задаётся', async () => {
    const { service, teachers } = make({ contract: false });
    const saved = await service.saveProfile('voskhod', 'teach', { about: '  Преподаю математику, 12 лет в школе  ', hourly_rate: '1200.0000 RUB' });
    expect(saved).toEqual({ about: 'Преподаю математику, 12 лет в школе', hourly_rate: '0.0000 RUB', rate_locked: false });
    expect(teachers.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ coopname: 'voskhod', teacher_username: 'teach', hourly_rate: '0.0000 RUB' }));
  });

  it('пустой рассказ о себе не принимается — в карточке преподавателя не должно быть пусто', async () => {
    const { service, teachers } = make({ contract: false });
    await expect(service.saveProfile('voskhod', 'teach', { about: '   ' })).rejects.toThrow(/Расскажите о себе/);
    expect(teachers.saveProfile).not.toHaveBeenCalled();
  });

  it('с договором профиль показывает ставку договора; названная преподавателем ставка её не меняет', async () => {
    const { service } = make();
    const saved = await service.saveProfile('voskhod', 'teach', { about: 'Дописал о себе', hourly_rate: '5000.0000 RUB' });
    expect(saved).toEqual({ about: 'Дописал о себе', hourly_rate: '1000.0000 RUB', rate_locked: true });
  });

  it('прекращённый договор ставку не держит — её назначают заново', async () => {
    const { service } = make({ contract: EduContractStatus.TERMINATED });
    const saved = await service.saveProfile('voskhod', 'teach', { about: 'Возвращаюсь преподавать', hourly_rate: '1500.0000 RUB' });
    expect(saved).toMatchObject({ hourly_rate: '0.0000 RUB', rate_locked: false });
  });

  it('профиль без записи: рассказ пуст, ставка — из договора либо не назначена', async () => {
    await expect(make().service.profile('voskhod', 'teach')).resolves.toEqual({ about: '', hourly_rate: '1000.0000 RUB', rate_locked: true });
    await expect(make({ contract: false }).service.profile('voskhod', 'teach')).resolves.toEqual({ about: '', hourly_rate: '0.0000 RUB', rate_locked: false });
  });

  it('договор подписывается без ставки: названная когда-то в профиле в договор не переходит', async () => {
    const named = make({ contract: false, profile: { about: 'Учу', hourly_rate: '1300.0000 RUB' } });
    const c = await named.service.signContract('voskhod', 'teach', signedBy('teach', 'NEW'), 'N-9');
    expect(c.hourly_rate).toBe('0.0000 RUB');
    expect(named.chain.signContract).toHaveBeenCalledTimes(1);
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
    await service.saveApprovedContractDocument('voskhod', 'H', approved);
    expect(teachers.saveContract.mock.calls[0]![0].contract_document).toBe(approved);
  });

  it('документ чужого договора и пустой документ запись не меняют', async () => {
    const { service, teachers } = make({ contract: EduContractStatus.ACTIVE });
    await service.saveApprovedContractDocument('voskhod', 'другой', approved);
    await service.saveApprovedContractDocument('voskhod', 'h', undefined);
    expect(teachers.saveContract).not.toHaveBeenCalled();
  });

  it('у договора без сохранённого документа просмотр отдаёт пусто, без обращения к реестру', async () => {
    const { service, documents } = make({ contract: EduContractStatus.ACTIVE });
    await expect(service.contractDocument('voskhod', 'teach')).resolves.toBeNull();
    expect(documents.buildAggregate).not.toHaveBeenCalled();
  });
});

describe('EdubridgeTeacherService — возврат паевого взноса одной кнопкой', () => {
  const HASH = 'a'.repeat(64);
  const transfer = (amount: string) => ({ ...signedBy('teach', 'WTH'), meta: { amount } });
  const ret = (quantity: string, payment_hash = HASH) => ({ ...signedBy('teach', 'RET'), meta: { quantity, currency: 'RUB', method_id: 'M1', payment_hash } });
  const request = (amount: string, over: Record<string, unknown> = {}) => ({
    amount,
    method_id: 'M1',
    payment_hash: HASH,
    transfer_statement: transfer(amount),
    return_statement: ret(amount.split(' ')[0]!),
    ...over,
  });

  it('заявление 3015 формируется на названную сумму в виде цепи', async () => {
    const { service, documents } = make();
    await service.shareWithdrawStatement('voskhod', 'teach', '1500');
    expect(documents.generate).toHaveBeenCalledWith({
      data: expect.objectContaining({ registry_id: R.EducationShareWithdrawStatement.registry_id, username: 'teach', amount: '1500.0000 RUB' }),
    });
  });

  it('по одной кнопке: перевод в цепь, заявка на возврат ядром под тот же платёж, связка сохранена', async () => {
    const { service, chain, walletWithdraw, teachers } = make();
    const s = await service.requestShareReturn('voskhod', 'teach', request('1500.0000 RUB'));
    expect(chain.withdrawShare).toHaveBeenCalledWith(expect.objectContaining({ coopname: 'voskhod', username: 'teach', amount: '1500.0000 RUB' }));
    expect(walletWithdraw.createWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: 'voskhod', username: 'teach', quantity: 1500, symbol: 'RUB', method_id: 'M1', payment_hash: HASH })
    );
    expect(teachers.saveShareReturn).toHaveBeenCalledWith(expect.objectContaining({ teacher_username: 'teach', amount: '1500.0000 RUB', payment_hash: HASH }));
    expect(s.program_share).toBe('3000.0000 RUB');
  });

  it('заявка не принята ядром после перевода — связка не пишется, ошибка наверх; перевод назад не откатывается', async () => {
    const { service, chain, walletWithdraw, teachers } = make();
    walletWithdraw.createWithdraw.mockRejectedValueOnce(new Error('GATEWAY_PAYMENT_METHOD_NOT_FOUND'));
    await expect(service.requestShareReturn('voskhod', 'teach', request('1500.0000 RUB'))).rejects.toThrow(/METHOD_NOT_FOUND/);
    expect(chain.withdrawShare).toHaveBeenCalledTimes(1);
    expect(teachers.saveShareReturn).not.toHaveBeenCalled();
  });

  it('сумма больше паевого взноса по программе — ничего не уходит', async () => {
    const { service, chain, walletWithdraw, documents } = make();
    await expect(service.shareWithdrawStatement('voskhod', 'teach', '3000.0001')).rejects.toThrow(/превышает паевой взнос по программе/);
    await expect(service.requestShareReturn('voskhod', 'teach', request('5000.0000 RUB'))).rejects.toThrow(/превышает паевой взнос по программе/);
    expect(documents.generate).not.toHaveBeenCalled();
    expect(chain.withdrawShare).not.toHaveBeenCalled();
    expect(walletWithdraw.createWithdraw).not.toHaveBeenCalled();
  });

  it.each(['0', '-5', 'abc', '', '100 USD'])('сумма «%s» отклоняется', async (amount) => {
    const { service, chain } = make();
    await expect(service.shareWithdrawStatement('voskhod', 'teach', amount)).rejects.toThrow(/сумму перевода больше нуля/);
    await expect(service.requestShareReturn('voskhod', 'teach', request(amount))).rejects.toThrow(/сумму перевода больше нуля/);
    expect(chain.withdrawShare).not.toHaveBeenCalled();
  });

  it('заявление о трансляции на другую сумму — ничего не уходит', async () => {
    const { service, chain, walletWithdraw } = make();
    await expect(service.requestShareReturn('voskhod', 'teach', request('1500.0000 RUB', { transfer_statement: transfer('1000.0000 RUB') }))).rejects.toThrow(/Сформируйте заявление заново/);
    expect(chain.withdrawShare).not.toHaveBeenCalled();
    expect(walletWithdraw.createWithdraw).not.toHaveBeenCalled();
  });

  it('заявление о возврате под другой платёж или другую сумму — ничего не уходит', async () => {
    const { service, chain, walletWithdraw } = make();
    await expect(service.requestShareReturn('voskhod', 'teach', request('1500.0000 RUB', { return_statement: ret('1500', 'b'.repeat(64)) }))).rejects.toThrow(/заявление о возврате/i);
    await expect(service.requestShareReturn('voskhod', 'teach', request('1500.0000 RUB', { return_statement: ret('1000') }))).rejects.toThrow(/заявление о возврате/i);
    expect(chain.withdrawShare).not.toHaveBeenCalled();
    expect(walletWithdraw.createWithdraw).not.toHaveBeenCalled();
  });

  it('документы возврата: оба заявления, и только своему преподавателю', async () => {
    const { service } = make();
    await service.requestShareReturn('voskhod', 'teach', request('1500.0000 RUB'));
    const docs = await service.shareReturnDocuments('voskhod', 'teach', 'R1');
    expect(docs.map((d) => d.kind)).toEqual(['transfer_statement', 'return_statement']);
    await expect(service.shareReturnDocuments('voskhod', 'other', 'R1')).rejects.toThrow();
    await expect(service.shareReturnDocuments('voskhod', 'teach', 'R9')).rejects.toThrow();
  });
});
