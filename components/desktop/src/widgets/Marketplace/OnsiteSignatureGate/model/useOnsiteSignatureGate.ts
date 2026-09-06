import { computed, ref } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { signingKeyOrAlert } from 'src/shared/lib/utils/signingKey';
import { groupAplReceptions, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  listAplReceptionsAsSupplier,
  signReceptionGroupAsSupplier,
  type MarketplaceAplReceptionView,
} from 'src/entities/MarketplaceAplReception';
import { cancelAplReception } from 'src/pages/Marketplace/OperatorReception/api';
import { Classes, Zeus } from '@coopenomics/sdk';
import {
  listStockProposals,
  finalizeStockIssuance,
  declineStockProposal,
  getStockProposalSignablePayloads,
  listIssuanceSagas,
  getIssuanceStatementPayload,
  signIssuanceStatement,
  getIssuanceActPayload,
  signIssuanceAct,
  type MarketplaceStockProposalView,
  type MarketplaceIssuanceSagaView,
  type IStockFinalizeOrderLine,
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

const supplierTasks = computed<ReceptionGroup<MarketplaceAplReceptionView>[]>(() =>
  groupAplReceptions(supplierReceptions.value, { byOfferer: false }).filter(
    (g) => g.status === PENDING_SUPPLIER_SIGN && IN_PERSON_VARIANTS.has(g.variant),
  ),
);

const proposalTasks = computed(() => stockProposals.value);
/** Акты/заявления по сагам вне бандла — только те, где ждут подпись пайщика. */
const sagaTasks = computed(() => memberSagas.value.filter((s) => s.awaits_member_signature));

/** Гейт виден, пока есть хоть одна личная подпись/решение, которых ждут от пайщика. */
const isVisible = computed(
  () => supplierTasks.value.length > 0 || proposalTasks.value.length > 0 || sagaTasks.value.length > 0,
);

/**
 * Тихий опрос обоих источников. Запросы независимы: сбой одного не гасит другой
 * и не алертит — это фоновый poll, не действие пользователя.
 */
async function refresh(source = 'ручной'): Promise<void> {
  const global = useGlobalStore();
  if (!global.wif) {
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
    stockProposals.value = proposals;
    memberSagas.value = sagas;
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
  const wif = await signingKeyOrAlert('Не удалось получить ключ поставщика для подписи');
  if (!wif) {
    return;
  }
  signingKey.value = group.key;
  try {
    const { errors } = await signReceptionGroupAsSupplier(group.receptions, wif);
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
  const wifKey = await signingKeyOrAlert('Не удалось получить ключ для подписи');
  if (!wifKey) {
    return;
  }
  const global = useGlobalStore();
  signingKey.value = task.id;
  try {
    const payload = await getStockProposalSignablePayloads(task.id);
    const signer = new Classes.Document(wifKey);
    const order_lines: IStockFinalizeOrderLine[] = await Promise.all(
      payload.order_lines.map(async (line) => ({
        order_hash: line.order_hash,
        signed_statement: (await signer.signDocument(
          line.statement,
          global.username,
          1,
        )) as IStockFinalizeOrderLine['signed_statement'],
      })),
    );

    const { sagas } = await finalizeStockIssuance(task.id, order_lines);
    const authorized = sagas.filter((s) => s.awaits_member_signature);
    const declined = sagas.filter((s) => s.stage === Zeus.MarketplaceIssuanceSagaStage.DECLINED);
    let actsSigned = 0;
    for (const saga of authorized) {
      try {
        await signActFor(saga.order_id, signer, global.username);
        actsSigned += 1;
      } catch (error) {
        FailAlert(error, 'Заявление подано, но акт подписать не удалось — подпишите его из «Моих заказов»');
      }
    }
    const pending = sagas.length - authorized.length - declined.length;
    if (actsSigned === sagas.length) {
      SuccessAlert(`Совет согласовал, акт подписан по ${actsSigned} позиц. Оператор закроет выдачу — забирайте.`);
    } else if (pending > 0) {
      SuccessAlert(
        `Заявления поданы (${sagas.length} позиц.). Решение совета ещё рассматривается — делать ничего не нужно, мы сообщим, когда оно будет принято.`,
      );
    } else if (declined.length) {
      FailAlert(new Error('Совет не согласовал выдачу — паевой взнос остался на Столе заказов.'));
    }
  } catch (error) {
    FailAlert(error);
  } finally {
    signingKey.value = null;
    await refresh();
  }
}

/** Заказы, по которым акт уже подписывается сам — второй раз не запускаем. */
const autoSigning = new Set<string>();

/**
 * Решение совета пришло по подписке, когда пайщик уже подписал заявление:
 * устройство ставит первую подпись акта без нового нажатия, если ключ сессии
 * доступен без PIN-кода. Иначе задача остаётся в гейте кнопкой «Подписать».
 */
async function autoSignAuthorizedActs(): Promise<void> {
  const global = useGlobalStore();
  const wif = global.wif?.toString();
  if (!wif || signingKey.value) return;
  const ready = memberSagas.value.filter(
    (s) => s.awaits_member_signature && s.stage === Zeus.MarketplaceIssuanceSagaStage.DECISION_AUTHORIZED && !autoSigning.has(s.order_id),
  );
  if (!ready.length) return;
  const signer = new Classes.Document(wif);
  for (const saga of ready) {
    autoSigning.add(saga.order_id);
    try {
      await signActFor(saga.order_id, signer, global.username);
      SuccessAlert(`Совет согласовал выдачу по заказу ${saga.order_id.slice(0, 8)} — акт подписан, имущество выдаст оператор участка.`);
    } catch (error) {
      // Не алертим: задача останется в гейте с кнопкой, пайщик подпишет вручную.
      console.warn('[OnsiteGate] автоподпись акта не удалась', error);
    } finally {
      autoSigning.delete(saga.order_id);
    }
  }
  await refresh('автоподпись акта');
}

/** Первая подпись акта приёма-передачи по решённой советом выдаче. */
async function signActFor(order_id: string, signer: Classes.Document, username: string): Promise<void> {
  const act = await getIssuanceActPayload(order_id);
  const signed_act = (await signer.signDocument(act, username, 1)) as Parameters<typeof signIssuanceAct>[0]['signed_act'];
  await signIssuanceAct({ order_id, signed_act });
}

/**
 * Подпись по саге вне бандла: заявление (факт зафиксирован, заявление ещё не
 * подписано) либо акт (совет решил, когда пайщик уже ушёл — подписывает где
 * угодно, заберёт при следующем визите).
 */
async function signSaga(task: MarketplaceIssuanceSagaView): Promise<void> {
  const wifKey = await signingKeyOrAlert('Не удалось получить ключ для подписи');
  if (!wifKey) {
    return;
  }
  const global = useGlobalStore();
  signingKey.value = task.id;
  try {
    const signer = new Classes.Document(wifKey);
    if (task.stage === Zeus.MarketplaceIssuanceSagaStage.FACT_FIXED) {
      const statement = await getIssuanceStatementPayload(task.order_id);
      const signed_statement = (await signer.signDocument(statement, global.username, 1)) as Parameters<
        typeof signIssuanceStatement
      >[0]['signed_statement'];
      const saga = await signIssuanceStatement({ order_id: task.order_id, signed_statement });
      if (saga.awaits_member_signature) {
        await signActFor(task.order_id, signer, global.username);
        SuccessAlert('Совет согласовал, акт подписан. Оператор закроет выдачу — забирайте.');
      } else if (saga.stage === Zeus.MarketplaceIssuanceSagaStage.DECLINED) {
        FailAlert(new Error('Совет не согласовал выдачу — паевой взнос остался на Столе заказов.'));
      } else {
        SuccessAlert('Заявление подано. Решение совета рассматривается — мы сообщим, когда оно будет принято.');
      }
    } else {
      await signActFor(task.order_id, signer, global.username);
      SuccessAlert('Акт подписан. Имущество выдаст оператор участка при вашем визите.');
    }
  } catch (error) {
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
    sagaTasks,
    refresh,
    signSupplier,
    cancelSupplier,
    signProposal,
    signSaga,
    declineProposal,
  };
}

export type { MarketplaceStockProposalView, MarketplaceIssuanceSagaView };
