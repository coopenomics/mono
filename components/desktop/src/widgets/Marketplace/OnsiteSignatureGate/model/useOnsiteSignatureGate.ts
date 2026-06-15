import { computed, ref } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { groupAplReceptions, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  listAplReceptionsAsSupplier,
  signReceptionGroupAsSupplier,
  type MarketplaceAplReceptionView,
} from 'src/pages/Marketplace/OffererPendingAplReceptions/api';
import { Classes } from '@coopenomics/sdk';
import {
  listMyReadyToReceive,
  finalizeOrdererIssuance,
  listStockProposals,
  acceptStockProposal,
  declineStockProposal,
  getStockProposalSignablePayloads,
  type MarketplaceOrderIssuanceView,
  type MarketplaceStockProposalView,
  type IStockConvertSigned,
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
 *  - ЗАКАЗЧИК: заказ готов к получению (председатель открыл выдачу первой
 *    подписью) и финальная подпись заказчика ещё не поставлена — он подтверждает
 *    получение второй (закрывающей) подписью.
 *
 * Канон подписей (L1): передающий подписывает первым, принимающий — последним.
 * Приёмка: поставщик(1) → председатель(2). Выдача: председатель(1) → заказчик(2).
 *
 * Оператора/председателя гейт НЕ трогает: он держит много заказов на стойке и
 * находит действия в своих столах сам — здесь запрашиваются только «мои как
 * поставщика» и «мои готовые к получению», то есть данные самого пайщика.
 *
 * Сигнал = сам статус. Источник обновлений — realtime-подписка marketplace
 * (персональный канал пайщика): на любое событие канал ядра дёргает refresh,
 * плюс catch-up при возврате приложения в активность и страховочный таймер.
 * Гейт сам закрывается, как только статус ушёл вперёд (подписал) ИЛИ оператор
 * откатил — после ближайшей дочитки список пустеет. Поллинга нет.
 */

interface OrdererPickupTask {
  /** Ключ группировки — braname пункта выдачи. */
  key: string;
  pointName: string;
  pointAddress: string;
  orders: MarketplaceOrderIssuanceView[];
  /** Совокупная сумма к получению по всем позициям пункта. */
  totalCost: string;
}

const PENDING_SUPPLIER_SIGN = 'PENDING_SUPPLIER_SIGN';
// Очная приёмка кодируется как 'A' / 'IN_PERSON' в зависимости от слоя — гейт
// блокирует ТОЛЬКО её; экспедиторскую (B / EXPEDITOR) не трогает.
const IN_PERSON_VARIANTS = new Set(['A', 'IN_PERSON']);

// Singleton-состояние (как у SelectBranchOverlay): один гейт на всё приложение.
const supplierReceptions = ref<MarketplaceAplReceptionView[]>([]);
const ordererOrders = ref<MarketplaceOrderIssuanceView[]>([]);
// Входящие предложения имущества со склада кооператива (докладка): оператор
// накинул у стойки — пайщик решает прямо в гейте (принять / отказаться).
const stockProposals = ref<MarketplaceStockProposalView[]>([]);
const loading = ref(false);
/** Ключ задачи (group.key / task.key), которая сейчас подписывается. */
const signingKey = ref<string | null>(null);

const supplierTasks = computed<ReceptionGroup<MarketplaceAplReceptionView>[]>(() =>
  groupAplReceptions(supplierReceptions.value, { byOfferer: false }).filter(
    (g) => g.status === PENDING_SUPPLIER_SIGN && IN_PERSON_VARIANTS.has(g.variant),
  ),
);

const ordererTasks = computed<OrdererPickupTask[]>(() => {
  // listMyReadyToReceive отдаёт заказы со статусом READY_TO_RECEIVE; фильтруем
  // ещё не подписанные заказчиком и группируем по пункту выдачи — одна подпись
  // на пункт (как в карточке «Моих заказов», задача #53).
  const pending = ordererOrders.value.filter((o) => !o.orderer_signed_at);
  const byPoint = new Map<string, MarketplaceOrderIssuanceView[]>();
  for (const o of pending) {
    const key = o.delivery_braname || o.delivery_point_name || o.id;
    const arr = byPoint.get(key) ?? [];
    arr.push(o);
    byPoint.set(key, arr);
  }
  return [...byPoint.entries()].map(([key, orders]) => ({
    key,
    pointName: orders[0]?.delivery_point_name ?? '',
    pointAddress: orders[0]?.delivery_point_address ?? '',
    orders,
    totalCost: orders
      .reduce(
        (sum, o) => sum + Number.parseFloat(o.issuance_fact?.fact_cost ?? o.total_cost ?? '0'),
        0,
      )
      .toFixed(4),
  }));
});

const proposalTasks = computed(() => stockProposals.value);

/** Гейт виден, пока есть хоть одна личная подпись/решение, которых ждут от пайщика. */
const isVisible = computed(
  () =>
    supplierTasks.value.length > 0 ||
    ordererTasks.value.length > 0 ||
    proposalTasks.value.length > 0,
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
    ordererOrders.value = [];
    stockProposals.value = [];
    return;
  }
  const wasVisible = isVisible.value;
  loading.value = true;
  try {
    const [receptions, orders, proposals] = await Promise.all([
      listAplReceptionsAsSupplier().catch(() => [] as MarketplaceAplReceptionView[]),
      listMyReadyToReceive().catch(() => [] as MarketplaceOrderIssuanceView[]),
      listStockProposals({ statuses: ['PROPOSED'] }).catch(
        () => [] as MarketplaceStockProposalView[],
      ),
    ]);
    supplierReceptions.value = receptions;
    ordererOrders.value = orders;
    stockProposals.value = proposals;
  } finally {
    loading.value = false;
  }
  // Явный маркер: ЧТО дёрнуло дочитку (ПОДПИСКА / POLL / ручной) и всплыл ли
  // гейт. Если overlay появился сразу после «✅ ПОДПИСКА СРАБОТАЛА» — отработал
  // сокет; если перед этим был «POLL» — сработала страховочная дочитка.
  const appeared = !wasVisible && isVisible.value;
  console.info(
    `%c[OnsiteGate] refresh ← ${source}: поставщик=${supplierTasks.value.length}, заказчик=${ordererTasks.value.length}, предложений=${proposalTasks.value.length}, гейт виден=${isVisible.value}${appeared ? ' (ВСПЛЫЛ только что)' : ''}`,
    appeared ? 'color:#16a34a;font-weight:bold' : 'color:#64748b',
  );
}

async function signSupplier(group: ReceptionGroup<MarketplaceAplReceptionView>): Promise<void> {
  const global = useGlobalStore();
  const wif = global.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ поставщика не найден. Войдите в кооператив.'));
    return;
  }
  signingKey.value = group.key;
  try {
    const { errors } = await signReceptionGroupAsSupplier(group.receptions, wif);
    if (errors.length === 0) {
      SuccessAlert('Поставка подписана. Ожидается закрывающая подпись председателя КУ.');
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

async function signOrderer(task: OrdererPickupTask): Promise<void> {
  const global = useGlobalStore();
  const wif = global.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  signingKey.value = task.key;
  try {
    const { ok, failed } = await finalizeOrdererIssuance(task.orders, wif, global.username);
    if (failed.length === 0) {
      SuccessAlert(`Имущество получено по ${ok} позиц. Заказы закрыты.`);
    } else {
      const names = failed.map((f) => f.order.product_name || f.order.id.slice(0, 8));
      FailAlert(
        new Error(
          `Получено ${ok} из ${task.orders.length}. Не удалось: ${names.join(', ')}. Повторите по оставшимся.`,
        ),
      );
    }
    await refresh();
  } finally {
    signingKey.value = null;
  }
}

/**
 * Пайщик принимает предложение со склада: по строкам создаются заказы (средства
 * резервируются на акцепте — при нехватке паевых средств backend вернёт
 * человеческую ошибку), и следом оператор открывает выдачу — акт придёт в этот
 * же гейт обычной задачей заказчика.
 */
async function acceptProposal(task: MarketplaceStockProposalView): Promise<void> {
  const global = useGlobalStore();
  const wifKey = global.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив заново.'));
    return;
  }
  signingKey.value = task.id;
  try {
    // Одно Заявление о конвертации на весь дефицит сверх членских средств; если
    // средств хватает (замена из высвобожденных — «возьмите вот это»), документа
    // нет и подписывать пайщику нечего.
    const payload = await getStockProposalSignablePayloads(task.id);
    let signed_convert: IStockConvertSigned | null = null;
    if (payload.convert_document) {
      const signer = new Classes.Document(wifKey);
      signed_convert = (await signer.signDocument(
        payload.convert_document,
        global.username,
        1,
      )) as IStockConvertSigned;
    }
    const { order_ids } = await acceptStockProposal(task.id, payload.order_lines, signed_convert);
    SuccessAlert(
      `Предложение принято: оформлено позиций со склада — ${order_ids.length}. Оператор откроет выдачу.`,
    );
  } catch (error) {
    FailAlert(error);
  } finally {
    signingKey.value = null;
    await refresh();
  }
}

async function declineProposal(task: MarketplaceStockProposalView): Promise<void> {
  signingKey.value = task.id;
  try {
    await declineStockProposal(task.id);
    SuccessAlert('Предложение отклонено.');
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
    ordererTasks,
    proposalTasks,
    refresh,
    signSupplier,
    signOrderer,
    acceptProposal,
    declineProposal,
  };
}

export type { OrdererPickupTask };
export type { MarketplaceStockProposalView };
