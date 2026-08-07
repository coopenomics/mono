import { computed, ref } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
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
// Единый бандл выдачи: оператор у стойки подписал акты (signiss1) по заказам
// и/или докладке и отправил пайщику — пайщик решает прямо в гейте (подписать
// получение / отменить). До его подписи на цепи ничего нет.
const stockProposals = ref<MarketplaceStockProposalView[]>([]);
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
  const desktop = useDesktopStore();
  loading.value = true;
  try {
    const [receptions, proposals] = await Promise.all([
      desktop.hasGrant(SUPPLIER_WORKSPACE, SUPPLIER_GRANT)
        ? listAplReceptionsAsSupplier().catch(() => [] as MarketplaceAplReceptionView[])
        : Promise.resolve([] as MarketplaceAplReceptionView[]),
      desktop.hasGrant(ORDERER_WORKSPACE, ORDERER_GRANT)
        ? listStockProposals({ statuses: [Zeus.MarketplaceStockProposalStatus.PROPOSED] }).catch(
            () => [] as MarketplaceStockProposalView[],
          )
        : Promise.resolve([] as MarketplaceStockProposalView[]),
    ]);
    supplierReceptions.value = receptions;
    stockProposals.value = proposals;
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
      const allRejected = group.lines.every((l) => l.quantity <= 0);
      SuccessAlert(
        allRejected
          ? 'Отказ в приёмке подтверждён. Заказчикам вернётся оплата.'
          : 'Поставка подписана. Ожидается закрывающая подпись председателя КУ.',
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
      payload.order_lines.map(async (line) => {
        const rawDocument = line.signiss1_aggregate.rawDocument;
        if (!rawDocument) {
          throw new Error(`Не найден исходный документ АПП-выдачи для заказа ${line.order_hash}`);
        }
        return {
          order_hash: line.order_hash,
          signed_signiss2_act: (await signer.signDocument(
            rawDocument,
            global.username,
            2,
            [line.signiss1_aggregate.document],
          )) as IStockFinalizeOrderLine['signed_signiss2_act'],
        };
      }),
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
    refresh,
    signSupplier,
    cancelSupplier,
    signProposal,
    declineProposal,
  };
}

export type { MarketplaceStockProposalView };
