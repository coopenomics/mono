import { computed, ref } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { ensureSigningUnlocked, signDocument } from 'src/shared/lib/document';
import { groupAplReceptions, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  listAplReceptionsAsSupplier,
  signReceptionGroupAsSupplier,
  type MarketplaceAplReceptionView,
} from 'src/entities/MarketplaceAplReception';
import { cancelAplReception } from 'src/pages/Marketplace/OperatorReception/api';
import { Zeus } from '@coopenomics/sdk';
import {
  listStockProposals,
  finalizeStockIssuance,
  declineStockProposal,
  getStockProposalSignablePayloads,
  listIssuanceSagas,
  getIssuanceStatementPayload,
  getIssuanceConvertPayload,
  signIssuanceStatement,
  getIssuanceActPayload,
  signIssuanceAct,
  type MarketplaceStockProposalView,
  type MarketplaceIssuanceSagaView,
  type IStockFinalizeOrderLine,
  type IStockProposalAcceptPayload,
  type IStockSignedConvert,
} from 'src/pages/Marketplace/OperatorIssuance/api';

/**
 * Глобальный гейт «подпись на месте» (Фаза 2, на realtime-подписке).
 *
 * Перекрывает весь экран ЛК, когда пайщик ЛИЧНО прибыл на ПВЗ и от него ждут
 * подпись акта — чтобы он не ушёл, не подписав:
 *  - ПОСТАВЩИК: акт приёмки в статусе ожидания его (первой) подписи И только
 *    при ОЧНОЙ доставке (variant A). При доставке через экспедитора экран НЕ
 *    блокируем — поставщик подписывает в своём столе в удобный момент, гейт
 *    не должен мешать его работе.
 *  - ЗАКАЗЧИК (паевая модель, компонент 68): оператор собрал бандл выдачи и
 *    зафиксировал факт — пайщик одним нажатием подписывает заявления о
 *    возврате паевого взноса имуществом по строкам; они уходят на повестку
 *    совета. Робот совета решает за секунды у стойки — тогда в том же потоке
 *    подписывается акт приёма-передачи; если решение ушло к людям, гейт
 *    закрывается, пайщик спокойно ждёт (push придёт, когда совет решит), а
 *    акт подписывает потом где угодно — гейт покажет его как отдельную задачу.
 *
 * Канон подписей: заявление и первую подпись акта ставит принимающий
 * (заказчик), закрывающую — оператор участка, когда имущество выдано.
 * Приёмка: поставщик(1) → председатель(2).
 *
 * Оператора/председателя гейт НЕ трогает: он держит много заказов на стойке и
 * находит действия в своих столах сам — здесь запрашиваются только «мои как
 * поставщика» и «мои готовые к получению», то есть данные самого пайщика.
 *
 * Сигнал = сам статус. Источник обновлений — realtime-подписка marketplace
 * (персональный канал пайщика): на любое событие канал ядра дёргает refresh,
 * плюс catch-up при возврате приложения в активность и страховочный таймер.
 * Гейт сам закрывается, как только статус ушёл вперёд (подписал) ИЛИ приёмка
 * откатили (поставщик / оператор) — после ближайшей дочитки список пустеет.
 * Поллинга нет.
 */

const PENDING_SUPPLIER_SIGN = 'PENDING_SUPPLIER_SIGN';

// Гейт глобальный (оверлей поверх всего ЛК), а его источники — приватные
// запросы разных ролей. Спрашиваем только то, на что у пайщика есть право:
// `marketplaceListAplReceptionsAsSupplier` закрыт `Shipment:create:own` (есть
// лишь у одобренного поставщика), `marketplaceListStockProposals` —
// `StockProposal:read:own` (есть у заказчика, прошедшего онбординг). Без
// проверки резолвер отвечает 403 на каждой страховочной дочитке (раз в 60 с),
// и хотя гейт ошибку глотает, лог кооператива забивается ForbiddenException.
const SUPPLIER_WORKSPACE = 'market-supplier';
const SUPPLIER_GRANT = 'Shipment:create:own';
const ORDERER_WORKSPACE = 'market';
const ORDERER_GRANT = 'StockProposal:read:own';
// Очная приёмка кодируется как 'A' / 'IN_PERSON' в зависимости от слоя — гейт
// блокирует ТОЛЬКО её; экспедиторскую (B / EXPEDITOR) не трогает.
const IN_PERSON_VARIANTS = new Set(['A', 'IN_PERSON']);

// Singleton-состояние (как у SelectBranchOverlay): один гейт на всё приложение.
const supplierReceptions = ref<MarketplaceAplReceptionView[]>([]);
// Единый бандл выдачи: оператор у стойки зафиксировал факт по заказам и/или
// докладке и отправил пайщику — пайщик решает прямо в гейте (подписать
// заявления / отменить). До его подписи на цепи ничего нет.
const stockProposals = ref<MarketplaceStockProposalView[]>([]);
// Саги выдачи, где ход за пайщиком: заявление (факт зафиксирован вне бандла)
// или акт после решения совета (решение пришло, когда пайщик уже ушёл).
const memberSagas = ref<MarketplaceIssuanceSagaView[]>([]);
const loading = ref(false);
/** Ключ задачи (group.key / task.key), которая сейчас подписывается. */
const signingKey = ref<string | null>(null);

/**
 * Поток получения у стойки — от нажатия «Подписать и получить» до подписанного
 * акта. Пока он идёт, гейт показывает не карточки с кнопками, а ход дела:
 * заявления → решение совета → акт → готово. Раньше между решением робота и
 * подписью акта дочитка по подписке успевала показать карточку «Акт
 * приёма-передачи — Подписать акт», которую тот же поток тут же подписывал
 * сам, и экран дёргался (жалоба владельца 2026-09-09). Карточка с кнопкой —
 * только там, где сама подпись не прошла.
 */
export type IssuanceFlowStep = 'statements' | 'council' | 'act' | 'done' | 'pending' | 'declined';
export interface IssuanceFlow {
  step: IssuanceFlowStep;
  /** Сколько позиций (саг) в потоке; 0 — ещё не знаем (до ответа совета). */
  total: number;
  /** Сколько актов уже подписано на шаге «act». */
  signedActs: number;
  /** Заказы потока: их саги не показываются карточками, пока поток идёт. */
  orderIds: Set<string>;
}
const issuanceFlow = ref<IssuanceFlow | null>(null);
/** Сколько держать итог потока на экране, прежде чем гейт закроется. */
const FLOW_RESULT_MS = 2_500;
let flowResultTimer: ReturnType<typeof setTimeout> | null = null;

function startFlow(): IssuanceFlow {
  if (flowResultTimer) {
    clearTimeout(flowResultTimer);
    flowResultTimer = null;
  }
  const flow: IssuanceFlow = { step: 'statements', total: 0, signedActs: 0, orderIds: new Set() };
  issuanceFlow.value = flow;
  return flow;
}

/** Шаг потока меняется через новый объект — иначе Vue не увидит правку поля. */
function setFlow(patch: Partial<IssuanceFlow>): void {
  if (!issuanceFlow.value) return;
  issuanceFlow.value = { ...issuanceFlow.value, ...patch };
}

/** Итог показан — поток закрывается сам, вместе с ним и гейт, если задач нет. */
function finishFlow(step: 'done' | 'pending' | 'declined'): void {
  setFlow({ step });
  flowResultTimer = setTimeout(() => {
    flowResultTimer = null;
    issuanceFlow.value = null;
  }, FLOW_RESULT_MS);
}

/** Поток оборвался ошибкой — панель снимаем сразу, задачи вернутся карточками. */
function abortFlow(): void {
  if (flowResultTimer) {
    clearTimeout(flowResultTimer);
    flowResultTimer = null;
  }
  issuanceFlow.value = null;
}

/** Заказы, по которым автоподпись акта не прошла: только им нужна кнопка. */
const autoSignFailed = ref<Set<string>>(new Set());

const supplierTasks = computed<ReceptionGroup<MarketplaceAplReceptionView>[]>(() =>
  groupAplReceptions(supplierReceptions.value, { byOfferer: false }).filter(
    (g) => g.status === PENDING_SUPPLIER_SIGN && IN_PERSON_VARIANTS.has(g.variant),
  ),
);

const proposalTasks = computed(() => stockProposals.value);
/** Заявление 1110 по бандлу (недостающая сумма и членская часть) — для показа перед подписью; null — перевод не нужен. */
const proposalConverts = ref<Record<string, NonNullable<IStockProposalAcceptPayload['convert']> | null>>({});
/**
 * Акты/заявления по сагам вне бандла — только те, где ждут подпись пайщика.
 * Заявление по строке живого бандла подписывается на самом бандле, поэтому
 * сага такой строки отдельной карточкой не показывается.
 */
/**
 * Акт, который устройство подпишет само: совет согласовал, прошлая попытка не
 * срывалась. Такие саги карточкой не показываются — вместо них панель
 * «подписываем акт». Запертый PIN-кодом ключ автоподписи не мешает: ключ
 * берётся через `ensureSigningKey`, и окно PIN-кода всплывает само —
 * системно, как перед любой подписью (решение владельца 2026-09-09). Кнопка
 * остаётся только там, где пайщик отказался вводить PIN-код или подпись
 * не прошла.
 */
function isAutoSignable(s: MarketplaceIssuanceSagaView): boolean {
  return (
    s.awaits_member_signature &&
    s.stage === Zeus.MarketplaceIssuanceSagaStage.DECISION_AUTHORIZED &&
    !autoSignFailed.value.has(s.order_id)
  );
}

const autoSignQueue = computed(() => memberSagas.value.filter(isAutoSignable));

const sagaTasks = computed(() => {
  const bundled = new Set(stockProposals.value.map((p) => p.id));
  const inFlow = issuanceFlow.value?.orderIds;
  return memberSagas.value.filter(
    (s) =>
      s.awaits_member_signature &&
      !(s.proposal_id && bundled.has(s.proposal_id)) &&
      !(inFlow && inFlow.has(s.order_id)) &&
      !isAutoSignable(s),
  );
});

/**
 * Идёт ли получение прямо сейчас — поток по нажатию либо автоподпись акта по
 * пришедшему решению совета. Оверлей в это время показывает ход дела.
 */
const activeFlow = computed<IssuanceFlow | null>(() => {
  if (issuanceFlow.value) return issuanceFlow.value;
  if (autoSignQueue.value.length) {
    return { step: 'act', total: autoSignQueue.value.length, signedActs: 0, orderIds: new Set() };
  }
  return null;
});

/** Гейт виден, пока есть личная подпись, которой ждут от пайщика, либо идёт получение. */
const isVisible = computed(
  () =>
    supplierTasks.value.length > 0 ||
    proposalTasks.value.length > 0 ||
    sagaTasks.value.length > 0 ||
    activeFlow.value !== null,
);

/**
 * Тихий опрос обоих источников. Запросы независимы: сбой одного не гасит другой
 * и не алертит — это фоновый poll, не действие пользователя.
 */
async function refresh(source = 'ручной'): Promise<void> {
  // Авторизация — по сессии, не по ключу в памяти: ключ CoopID запирается
  // PIN-кодом по простою и после перезагрузки, но пайщик остаётся в кабинете и
  // задачи на подпись ему показывать надо; ключ спросится при самой подписи.
  const session = useSessionStore();
  if (!session.isAuth) {
    // Не залогинен — гейта нет, очищаем возможный хвост.
    supplierReceptions.value = [];
    stockProposals.value = [];
    memberSagas.value = [];
    return;
  }
  const wasVisible = isVisible.value;
  const desktop = useDesktopStore();
  loading.value = true;
  try {
    const isOrderer = desktop.hasGrant(ORDERER_WORKSPACE, ORDERER_GRANT);
    const [receptions, proposals, sagas] = await Promise.all([
      desktop.hasGrant(SUPPLIER_WORKSPACE, SUPPLIER_GRANT)
        ? listAplReceptionsAsSupplier().catch(() => [] as MarketplaceAplReceptionView[])
        : Promise.resolve([] as MarketplaceAplReceptionView[]),
      isOrderer
        ? listStockProposals({ statuses: [Zeus.MarketplaceStockProposalStatus.PROPOSED] }).catch(
            () => [] as MarketplaceStockProposalView[],
          )
        : Promise.resolve([] as MarketplaceStockProposalView[]),
      isOrderer
        ? listIssuanceSagas({ active_only: true }).catch(() => [] as MarketplaceIssuanceSagaView[])
        : Promise.resolve([] as MarketplaceIssuanceSagaView[]),
    ]);
    supplierReceptions.value = receptions;
    // Оператору участка резолвер отдаёт бандлы всей стойки — гейт же личный:
    // показываем только адресованные самому пайщику.
    const me = session.username;
    stockProposals.value = me ? proposals.filter((p) => p.member_account === me) : proposals;
    memberSagas.value = sagas;
    // Суммы перевода по бандлам — чтобы пайщик видел, сколько уйдёт с паевого, до нажатия.
    const converts = await Promise.all(
      proposals.map(async (p) => [p.id, (await getStockProposalSignablePayloads(p.id).catch(() => null))?.convert ?? null] as const),
    );
    proposalConverts.value = Object.fromEntries(converts);
  } finally {
    loading.value = false;
  }
  // Совет решил, пока приложение открыто: акт подписывается сам, без нажатия
  // (FR-B5 / L19) — если ключ сессии отперт. Заперт PIN-кодом — остаётся кнопка.
  void autoSignAuthorizedActs();
  // Явный маркер: ЧТО дёрнуло дочитку (ПОДПИСКА / POLL / ручной) и всплыл ли
  // гейт. Если overlay появился сразу после «✅ ПОДПИСКА СРАБОТАЛА» — отработал
  // сокет; если перед этим был «POLL» — сработала страховочная дочитка.
  const appeared = !wasVisible && isVisible.value;
  console.info(
    `%c[OnsiteGate] refresh ← ${source}: поставщик=${supplierTasks.value.length}, бандлов=${proposalTasks.value.length}, актов/заявлений=${sagaTasks.value.length}, гейт виден=${isVisible.value}${appeared ? ' (ВСПЛЫЛ только что)' : ''}`,
    appeared ? 'color:#16a34a;font-weight:bold' : 'color:#64748b',
  );
}

async function signSupplier(group: ReceptionGroup<MarketplaceAplReceptionView>): Promise<void> {
  if (!(await ensureSigningUnlocked('Не удалось получить ключ поставщика для подписи'))) return;
  signingKey.value = group.key;
  try {
    const { errors } = await signReceptionGroupAsSupplier(group.receptions);
    if (errors.length === 0) {
      const allRejected = group.lines.every((l) => l.quantity <= 0);
      SuccessAlert(
        allRejected
          ? 'Отказ в приёмке подтверждён. Заказчикам вернётся оплата.'
          : 'Поставка подписана. Ожидается закрывающая подпись оператора участка.',
      );
    } else {
      for (const { receptionId, error } of errors) {
        FailAlert(error, `Не удалось подписать один из актов поставки (${receptionId.slice(0, 8)})`);
      }
    }
    await refresh();
  } finally {
    signingKey.value = null;
  }
}

/**
 * Пайщик ОДНИМ нажатием подписывает заявления о возврате паевого взноса
 * имуществом по всем строкам бандла. Backend создаёт заказы из остатка,
 * подаёт заявления на повестку совета и зовёт робота напрямую. Если робот
 * решил у стойки — сразу же подписываем акты по решённым заказам (то же
 * нажатие, ключ уже в руках); если решение ушло к людям — ничего не ждём:
 * пайщик спокойно уходит, push придёт, когда совет решит.
 */
async function signProposal(task: MarketplaceStockProposalView): Promise<void> {
  // PIN-код спросится на первой подписи — заявлении; дальше ключ в руках.
  const global = useGlobalStore();
  signingKey.value = task.id;
  startFlow();
  try {
    const payload = await getStockProposalSignablePayloads(task.id);
    // По каждой строке — заявление о выдаче (1113); если членского кошелька
    // не хватает на бандл — одно заявление 1110 о переводе недостающего.
    const order_lines: IStockFinalizeOrderLine[] = await Promise.all(
      payload.order_lines.map(async (line) => ({
        order_hash: line.order_hash,
        signed_statement: (await signDocument(
          line.statement,
          global.username,
          1,
        )) as IStockFinalizeOrderLine['signed_statement'],
      })),
    );
    const signed_convert = payload.convert
      ? ((await signDocument(payload.convert.document, global.username, 1)) as IStockSignedConvert)
      : null;

    // Заявления подписаны — уходят совету; робот решает за секунды у стойки.
    setFlow({ step: 'council', total: order_lines.length });
    const { sagas } = await finalizeStockIssuance(task.id, order_lines, signed_convert);
    const authorized = sagas.filter((s) => s.awaits_member_signature);
    const declined = sagas.filter((s) => s.stage === Zeus.MarketplaceIssuanceSagaStage.DECLINED);
    setFlow({ step: 'act', total: sagas.length, orderIds: new Set(sagas.map((x) => x.order_id)) });
    let actsSigned = 0;
    for (const saga of authorized) {
      try {
        await signActFor(saga.order_id, global.username);
        actsSigned += 1;
        setFlow({ signedActs: actsSigned });
      } catch (error) {
        // Кнопка по этому акту появится в гейте — как раз для такого случая.
        autoSignFailed.value = new Set([...autoSignFailed.value, saga.order_id]);
        FailAlert(error, 'Заявление подано, но акт подписать не удалось — подпишите его кнопкой ниже');
      }
    }
    const pending = sagas.length - authorized.length - declined.length;
    if (actsSigned === sagas.length) {
      finishFlow('done');
      SuccessAlert(`Совет согласовал, акт подписан по ${actsSigned} позиц. Оператор закроет выдачу — забирайте.`);
    } else if (pending > 0) {
      finishFlow('pending');
      SuccessAlert(
        `Заявления поданы (${sagas.length} позиц.). Решение совета ещё рассматривается — делать ничего не нужно, мы сообщим, когда оно будет принято.`,
      );
    } else if (declined.length) {
      finishFlow('declined');
      FailAlert(new Error('Совет не согласовал выдачу — паевой взнос остался на Столе заказов.'));
    } else {
      abortFlow();
    }
  } catch (error) {
    abortFlow();
    FailAlert(error);
  } finally {
    signingKey.value = null;
    await refresh();
  }
}

/** Заказы, по которым акт уже подписывается сам — второй раз не запускаем. */
const autoSigning = new Set<string>();
/**
 * Автоподпись идёт — параллельный запуск с очередной дочитки не нужен: он
 * поднял бы второе окно PIN-кода поверх первого.
 */
let autoSignRunning = false;

/**
 * Решение совета пришло по подписке, когда пайщик уже подписал заявление:
 * устройство ставит первую подпись акта без нового нажатия. Ключ заперт —
 * окно PIN-кода всплывает само; отказался — акт остаётся в гейте кнопкой.
 */
async function autoSignAuthorizedActs(): Promise<void> {
  if (autoSignRunning || signingKey.value) return;
  const ready = autoSignQueue.value.filter((s) => !autoSigning.has(s.order_id));
  if (!ready.length) return;
  const global = useGlobalStore();
  autoSignRunning = true;
  // Ключ отпираем до серии: отказ от PIN-кода — один раз, и все акты очереди
  // остаются кнопками (по нажатию PIN-код спросится снова).
  if (!(await ensureSigningUnlocked('Для подписи акта нужен PIN-код'))) {
    autoSignFailed.value = new Set([...autoSignFailed.value, ...ready.map((s) => s.order_id)]);
    autoSignRunning = false;
    return;
  }
  for (const saga of ready) {
    autoSigning.add(saga.order_id);
    try {
      await signActFor(saga.order_id, global.username);
      SuccessAlert(`Совет согласовал выдачу по заказу ${saga.order_id.slice(0, 8)} — акт подписан, имущество выдаст оператор участка.`);
    } catch (error) {
      // Не алертим: акт выпадает из автоподписи и остаётся в гейте кнопкой —
      // пайщик подпишет вручную.
      console.warn('[OnsiteGate] автоподпись акта не удалась', error);
      autoSignFailed.value = new Set([...autoSignFailed.value, saga.order_id]);
    } finally {
      autoSigning.delete(saga.order_id);
    }
  }
  autoSignRunning = false;
  await refresh('автоподпись акта');
}

/** Первая подпись акта приёма-передачи по решённой советом выдаче. */
async function signActFor(order_id: string, username: string): Promise<void> {
  const act = await getIssuanceActPayload(order_id);
  const signed_act = (await signDocument(act, username, 1)) as Parameters<typeof signIssuanceAct>[0]['signed_act'];
  await signIssuanceAct({ order_id, signed_act });
}

/**
 * Подпись по саге вне бандла: заявление (факт зафиксирован, заявление ещё не
 * подписано) либо акт (совет решил, когда пайщик уже ушёл — подписывает где
 * угодно, заберёт при следующем визите).
 */
async function signSaga(task: MarketplaceIssuanceSagaView): Promise<void> {
  const global = useGlobalStore();
  // Ключ задачи — строка: идентификатор саги приходит из схемы скаляром ID.
  signingKey.value = String(task.id);
  const isStatement = task.stage === Zeus.MarketplaceIssuanceSagaStage.FACT_FIXED;
  if (isStatement) {
    const flow = startFlow();
    flow.orderIds.add(task.order_id);
    setFlow({ total: 1 });
  }
  try {
    if (isStatement) {
      const statement = await getIssuanceStatementPayload(task.order_id);
      const signed_statement = (await signDocument(statement, global.username, 1)) as Parameters<
        typeof signIssuanceStatement
      >[0]['signed_statement'];
      // Довзнос по факту сверх членского кошелька — заявление о конвертации (1110)
      // подписывается тем же нажатием; в обычной выдаче его нет.
      const convert = await getIssuanceConvertPayload(task.order_id);
      const signed_convert = convert
        ? ((await signDocument(convert, global.username, 1)) as NonNullable<
            Parameters<typeof signIssuanceStatement>[0]['signed_convert']
          >)
        : null;
      setFlow({ step: 'council' });
      const saga = await signIssuanceStatement({ order_id: task.order_id, signed_statement, signed_convert });
      if (saga.awaits_member_signature) {
        setFlow({ step: 'act' });
        await signActFor(task.order_id, global.username);
        setFlow({ signedActs: 1 });
        finishFlow('done');
        SuccessAlert('Совет согласовал, акт подписан. Оператор закроет выдачу — забирайте.');
      } else if (saga.stage === Zeus.MarketplaceIssuanceSagaStage.DECLINED) {
        finishFlow('declined');
        FailAlert(new Error('Совет не согласовал выдачу — паевой взнос остался на Столе заказов.'));
      } else {
        finishFlow('pending');
        SuccessAlert('Заявление подано. Решение совета рассматривается — мы сообщим, когда оно будет принято.');
      }
    } else {
      await signActFor(task.order_id, global.username);
      // Подписал руками — пометка о сорвавшейся автоподписи больше не нужна.
      const failed = new Set(autoSignFailed.value);
      failed.delete(task.order_id);
      autoSignFailed.value = failed;
      SuccessAlert('Акт подписан. Имущество выдаст оператор участка при вашем визите.');
    }
  } catch (error) {
    if (isStatement) abortFlow();
    FailAlert(error);
  } finally {
    signingKey.value = null;
    await refresh();
  }
}

async function cancelSupplier(group: ReceptionGroup<MarketplaceAplReceptionView>): Promise<void> {
  signingKey.value = group.key;
  try {
    // До подписи поставщика на цепи ничего нет — cancelAplReception откатывает
    // черновик в PG (CANCELLED + партия → SUPPLY_PREPARED). Оператор снова
    // примет имущество и покажет QR; гейт всплывёт заново.
    for (const r of group.receptions) {
      await cancelAplReception({ apl_reception_id: r.id });
    }
    SuccessAlert('Приёмка отменена. Оператор сформирует акт заново.');
  } catch (error) {
    FailAlert(error, 'Не удалось отменить приёмку');
  } finally {
    signingKey.value = null;
    await refresh();
  }
}

async function declineProposal(task: MarketplaceStockProposalView): Promise<void> {
  signingKey.value = task.id;
  try {
    await declineStockProposal(task.id);
    SuccessAlert('Получение отменено. Оператор сформирует выдачу заново.');
  } catch (error) {
    FailAlert(error);
  } finally {
    signingKey.value = null;
    await refresh();
  }
}

export function useOnsiteSignatureGate() {
  return {
    isVisible,
    loading,
    signingKey,
    supplierTasks,
    proposalTasks,
    proposalConverts,
    sagaTasks,
    activeFlow,
    refresh,
    signSupplier,
    cancelSupplier,
    signProposal,
    signSaga,
    declineProposal,
  };
}

export type { MarketplaceStockProposalView, MarketplaceIssuanceSagaView };
