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
  listStockProposals,
  finalizeStockIssuance,
  declineStockProposal,
  getStockProposalSignablePayloads,
  type MarketplaceStockProposalView,
  type IStockConvertSigned,
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

const PENDING_SUPPLIER_SIGN = 'PENDING_SUPPLIER_SIGN';
// Очная приёмка кодируется как 'A' / 'IN_PERSON' в зависимости от слоя — гейт
// блокирует ТОЛЬКО её; экспедиторскую (B / EXPEDITOR) не трогает.
const IN_PERSON_VARIANTS = new Set(['A', 'IN_PERSON']);

// Singleton-состояние (как у SelectBranchOverlay): один гейт на всё приложение.
const supplierReceptions = ref<MarketplaceAplReceptionView[]>([]);
// Единый бандл выдачи: оператор у стойки подписал акты (signiss1) по заказам
// и/или докладке и отправил пайщику — пайщик решает прямо в гейте (подписать
// получение / отменить). До его подписи на цепи ничего нет.
const stockProposals = ref<MarketplaceStockProposalView[]>([]);
// Разложение стоимости докладки по предложению: сколько спишется с уже внесённых
// членских и сколько уйдёт в конвертацию с паевого (по Заявлению). Предзагружается,
// чтобы пайщик видел суммы ДО подписи; кэш по proposal_id.
const proposalSums = ref<Record<string, { member_amount: string; convert_amount: string | null }>>(
  {},
);
const loading = ref(false);
/** Ключ задачи (group.key / task.key), которая сейчас подписывается. */
const signingKey = ref<string | null>(null);

const supplierTasks = computed<ReceptionGroup<MarketplaceAplReceptionView>[]>(() =>
  groupAplReceptions(supplierReceptions.value, { byOfferer: false }).filter(
    (g) => g.status === PENDING_SUPPLIER_SIGN && IN_PERSON_VARIANTS.has(g.variant),
  ),
);

const proposalTasks = computed(() => stockProposals.value);

/** Гейт виден, пока есть хоть одна личная подпись/решение, которых ждут от пайщика. */
const isVisible = computed(
  () => supplierTasks.value.length > 0 || proposalTasks.value.length > 0,
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
    return;
  }
  const wasVisible = isVisible.value;
  loading.value = true;
  try {
    const [receptions, proposals] = await Promise.all([
      listAplReceptionsAsSupplier().catch(() => [] as MarketplaceAplReceptionView[]),
      listStockProposals({ statuses: ['PROPOSED'] }).catch(
        () => [] as MarketplaceStockProposalView[],
      ),
    ]);
    supplierReceptions.value = receptions;
    stockProposals.value = proposals;
    // Подтягиваем разложение сумм (с членского / с паевого) для показа в карточке —
    // не блокирует дочитку; кэш по id, ушедшие предложения чистятся.
    void loadProposalSums(proposals);
  } finally {
    loading.value = false;
  }
  // Явный маркер: ЧТО дёрнуло дочитку (ПОДПИСКА / POLL / ручной) и всплыл ли
  // гейт. Если overlay появился сразу после «✅ ПОДПИСКА СРАБОТАЛА» — отработал
  // сокет; если перед этим был «POLL» — сработала страховочная дочитка.
  const appeared = !wasVisible && isVisible.value;
  console.info(
    `%c[OnsiteGate] refresh ← ${source}: поставщик=${supplierTasks.value.length}, актов на подпись=${proposalTasks.value.length}, гейт виден=${isVisible.value}${appeared ? ' (ВСПЛЫЛ только что)' : ''}`,
    appeared ? 'color:#16a34a;font-weight:bold' : 'color:#64748b',
  );
}

/**
 * Предзагрузка разложения сумм по каждому предложению докладки для показа
 * пайщику до подписи. Кэш по proposal_id (генерация payload включает документ
 * конвертации — не дёргаем повторно); ушедшие предложения вычищаются.
 */
async function loadProposalSums(proposals: MarketplaceStockProposalView[]): Promise<void> {
  const ids = new Set(proposals.map((p) => p.id));
  const pruned = Object.fromEntries(
    Object.entries(proposalSums.value).filter(([id]) => ids.has(id)),
  );
  proposalSums.value = pruned;
  for (const p of proposals) {
    if (proposalSums.value[p.id]) continue;
    try {
      const payload = await getStockProposalSignablePayloads(p.id);
      proposalSums.value = {
        ...proposalSums.value,
        [p.id]: {
          member_amount: payload.member_amount,
          convert_amount: payload.convert_amount ?? null,
        },
      };
    } catch {
      // Без разложения — карточка покажет итог по предложению.
    }
  }
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

/**
 * Пайщик ОДНОЙ подписью утверждает бандл как акт получения. Подписывает:
 * при дефиците членских — единое Заявление о конвертации (paевой → членский),
 * затем по каждой строке контрподписывает АПП-выдачи (signiss2) поверх подписи
 * оператора. Backend создаёт заказы из остатка и проводит выдачу — имущество
 * выдаётся сразу. Никакого отдельного «Принять»: принятие = подпись акта.
 */
async function signProposal(task: MarketplaceStockProposalView): Promise<void> {
  const global = useGlobalStore();
  const wifKey = global.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив заново.'));
    return;
  }
  signingKey.value = task.id;
  try {
    const payload = await getStockProposalSignablePayloads(task.id);
    const signer = new Classes.Document(wifKey);

    // 1. Заявление о конвертации — только при дефиците членских средств (иначе
    //    convert_document пустой и подписывать нечего, кроме самих актов).
    let signed_convert: IStockConvertSigned | null = null;
    if (payload.convert_document) {
      signed_convert = (await signer.signDocument(
        payload.convert_document,
        global.username,
        1,
      )) as IStockConvertSigned;
    }

    // 2. Контрподпись получения (signiss2) поверх подписи оператора по каждой
    //    строке — документ НЕ перегенерируется, берётся агрегат rawDocument +
    //    document с подписью оператора (канон 2-подписи).
    const order_lines: IStockFinalizeOrderLine[] = await Promise.all(
      payload.order_lines.map(async (line) => ({
        order_hash: line.order_hash,
        signed_signiss2_act: (await signer.signDocument(
          line.signiss1_aggregate.rawDocument,
          global.username,
          2,
          [line.signiss1_aggregate.document],
        )) as IStockFinalizeOrderLine['signed_signiss2_act'],
      })),
    );

    const { order_ids } = await finalizeStockIssuance(task.id, order_lines, signed_convert);
    SuccessAlert(`Имущество получено по ${order_ids.length} позиц. Акт подписан.`);
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
    SuccessAlert('Получение отменено. Оператор сформирует акт заново.');
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
    proposalSums,
    refresh,
    signSupplier,
    signProposal,
    declineProposal,
  };
}

export type { MarketplaceStockProposalView };
