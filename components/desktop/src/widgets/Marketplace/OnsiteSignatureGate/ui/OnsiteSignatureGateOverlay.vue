<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base';
import {
  ActDialogLayout,
  ActLineItem,
  ActLinesTable,
  ActSummaryCard,
  ActWorkspaceRow,
  type ActLinesColumn,
} from 'src/widgets/Marketplace/ActDialogLayout';
import { VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import {
  type ReceptionGroup,
  getMembershipFeePercent,
  applyMembershipFee,
  computeIssuanceDiff,
} from 'src/shared/lib/marketplace';
import { marketplaceOrderSaleUnitLabel, marketplaceSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { fetchSupplierSignablePayloads, type MarketplaceAplReceptionView } from 'src/entities/MarketplaceAplReception';
import { FailAlert } from 'src/shared/api';
import { sanitizeDocumentHtml } from 'src/shared/lib/utils';
import { useOnsiteSignatureGate } from '../model/useOnsiteSignatureGate';
import { t } from 'src/shared/i18n';

/**
 * Глобальный оверлей подписи на месте — монтируется один раз в App.vue рядом с
 * прочими app-level гейтами (RequireAgreements, SelectBranchOverlay). Сам опрос
 * и логика — в useOnsiteSignatureGate; здесь только persistent-окно и вёрстка.
 *
 * Persistent-режим (no-backdrop / no-escape / no-close): пайщик не может
 * «увести» окно — закрывает его только сама подпись (статус ушёл вперёд) либо
 * отмена (поставщик / оператор откатили черновик приёмки; пайщик отказался
 * от бандла выдачи). Это легитимное исключение из правила «не перекрывать
 * экран»: осознанный consent-gate, как онбординг-оферты.
 */

const {
  isVisible,
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
  activeFlow,
} = useOnsiteSignatureGate();

// ─── Ход получения ───
// Пока идёт поток (заявления → совет → акт), карточки с кнопками не нужны:
// пайщик нажал одну кнопку и смотрит, как дело движется. Карточка акта с
// кнопкой вернётся только там, где подпись сама не прошла.
const FLOW_STEPS: StepperStep[] = [
  { key: 'statements', label: t('marketplace.onsiteSignatureGateOverlay.stepStatementsLabel'), description: t('marketplace.onsiteSignatureGateOverlay.stepStatementsDescription') },
  { key: 'council', label: t('marketplace.onsiteSignatureGateOverlay.stepCouncilLabel'), description: t('marketplace.onsiteSignatureGateOverlay.stepCouncilDescription') },
  { key: 'act', label: t('marketplace.onsiteSignatureGateOverlay.actLabel'), description: t('marketplace.onsiteSignatureGateOverlay.stepActDescription') },
];
const flowStep = computed(() => activeFlow.value?.step ?? null);
const flowActiveKey = computed(() => {
  const step = flowStep.value;
  if (step === 'done') return 'act';
  if (step === 'pending' || step === 'declined') return 'council';
  return step ?? 'statements';
});
const flowCompleted = computed<string[]>(() => {
  switch (flowStep.value) {
    case 'council':
    case 'pending':
    case 'declined':
      return ['statements'];
    case 'act':
      return ['statements', 'council'];
    case 'done':
      return ['statements', 'council', 'act'];
    default:
      return [];
  }
});
const flowErrored = computed<string[]>(() => (flowStep.value === 'declined' ? ['council'] : []));
/** Поток ещё идёт — под активным шагом бежит полоса. */
const flowRunning = computed(() =>
  flowStep.value === 'statements' ||
  flowStep.value === 'council' ||
  flowStep.value === 'act',
);
const flowTitle = computed(() => {
  switch (flowStep.value) {
    case 'done':
      return t('marketplace.onsiteSignatureGateOverlay.flowTitle.done');
    case 'pending':
      return t('marketplace.onsiteSignatureGateOverlay.flowTitle.pending');
    case 'declined':
      return t('marketplace.onsiteSignatureGateOverlay.flowTitle.declined');
    default:
      return t('marketplace.onsiteSignatureGateOverlay.pickupPointLabel');
  }
});
const flowSub = computed(() => {
  const flow = activeFlow.value;
  switch (flow?.step) {
    case 'statements':
      return t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.statements');
    case 'council':
      return t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.council');
    case 'act':
      return flow.total > 1
        ? t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.actProgress', { signed: flow.signedActs, total: flow.total })
        : t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.actSingle');
    case 'done':
      return t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.done');
    case 'pending':
      return t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.pending');
    case 'declined':
      return t('marketplace.onsiteSignatureGateOverlay.flowSubtitle.declined');
    default:
      return '';
  }
});
const dialogTitle = computed(() => (activeFlow.value ? t('marketplace.onsiteSignatureGateOverlay.dialogTitleActive') : t('marketplace.onsiteSignatureGateOverlay.dialogTitleIdle')));

const systemStore = useSystemStore();
const kuStore = useMarketplaceKUDetailsStore();

// Человекочитаемое имя КУ + адрес для поставщика (у заказа адрес пункта уже есть
// в самих данных). Реквизиты КУ грузим лениво — только когда впервые появляется
// очная поставка и стор ещё пуст; не дёргаем на каждом тике.
let kuLoaded = false;
function ensureKuDetails(): void {
  if (kuLoaded || !supplierTasks.value.length) return;
  kuLoaded = true;
  void kuStore
    .load({ coopname: systemStore.info.coopname, onlyActive: false })
    .catch(() => undefined);
}
watch(supplierTasks, ensureKuDetails, { immediate: false });

function kuName(braname: string): string {
  return kuStore.details.find((d) => d.coreBraname === braname)?.name || braname;
}
function kuAddr(braname: string): string {
  return kuStore.details.find((d) => d.coreBraname === braname)?.addressFull ?? '';
}

// Позиция предложения ведётся в единицах отпуска: количество — число
// упаковок, `unit_price` — цена за упаковку. Размерности совпадают, поэтому
// произведение прямое (см. канон единицы отпуска в README расширения).
function proposalLineCost(i: { quantity: number; unit_price: string }): string {
  return (i.quantity * Number.parseFloat(i.unit_price)).toFixed(4);
}

// Себестоимость акта (p.total_cost) — без членского взноса; пайщик платит
// взнос сверх неё (requirement b6, та же формула, что в каталоге/корзине).
// Раньше на этом экране взнос не был виден вовсе — жалоба 2026-08-02.
const feePercent = ref(0);
function proposalFeeAmount(p: { total_cost: string }): string {
  return (applyMembershipFee(Number(p.total_cost), feePercent.value) - Number(p.total_cost)).toFixed(4);
}
function proposalTotalWithFee(p: { total_cost: string }): string {
  return applyMembershipFee(Number(p.total_cost), feePercent.value).toFixed(4);
}

/**
 * Что станет с зарезервированными деньгами: разница между суммой заказа
 * (резерв) и фактом к выдаче. Меньше факта — остаток вернётся в кошелёк
 * «Стола заказов», больше — разницу доберут с паевого. Считается только по
 * строкам существующих заказов: у докладки со склада резерва ещё нет, заказ
 * родится на этой же подписи.
 */
function proposalDiff(p: {
  items: Array<{
    quantity: number;
    unit_price: string;
    order_id?: string | null;
    ordered_total_cost?: string | null;
  }>;
}): { refund: number; surcharge: number } {
  const lines = p.items
    .filter((i) => i.order_id && i.ordered_total_cost != null)
    .map((i) => ({
      orderedTotal: Number(i.ordered_total_cost),
      factTotal: Number(proposalLineCost(i)),
    }));
  return computeIssuanceDiff(lines, feePercent.value);
}

/** Разница по каждому бандлу — считаем один раз на отрисовку, а не в разметке. */
const proposalDiffs = computed<Record<string, { refund: number; surcharge: number }>>(() => {
  const out: Record<string, { refund: number; surcharge: number }> = {};
  for (const p of proposalTasks.value) out[p.id] = proposalDiff(p);
  return out;
});

function receptionLineQuantity(l: { quantity: number; unit: string; packageSize: number | null }): string {
  return marketplaceOrderSaleUnitLabel(l.quantity, l.unit, l.packageSize);
}

// Единица измерения у позиции предложения необязательна (услуги её не имеют),
// поэтому принимаем и отсутствующее значение, а не только явный null.
/**
 * Количество позиции предложения уже ведётся в единицах отпуска (число
 * упаковок при упаковочном отпуске) — как её набирал оператор и как считается
 * `unit_price`. Поэтому подпись строится без пересчёта: делить количество на
 * фасовку здесь нельзя, иначе «2 упаковки» превращаются в «0».
 */
function proposalItemQuantity(i: {
  quantity: number;
  unit_of_measure?: string | null;
  package_size?: number | null;
}): string {
  return `${i.quantity} ${marketplaceSaleUnitLabel(i.unit_of_measure ?? null, i.package_size ?? null)}`;
}

// ── Таблицы и сводки задач (общие компоненты актов) ──
/** Сумма в рублях для показа: два знака, разряды, знак рубля. */
function rub(value: string | number): string {
  return `${formatAsset2Digits(Number(value).toFixed(4))} ₽`;
}

/** Колонки таблицы задачи: позиция · количество · сумма. */
const readColumns = computed<ActLinesColumn[]>(() => [
  { key: 'item', label: t('marketplace.onsiteSignatureGateOverlay.column.product'), wide: true },
  { key: 'quantity', label: t('marketplace.onsiteSignatureGateOverlay.column.quantity'), width: '160px', align: 'right' },
  { key: 'amount', label: t('marketplace.onsiteSignatureGateOverlay.column.amount'), width: '120px', align: 'right', strong: true },
]);

type TaskRow = { key: string; title: string; meta?: string; imageUrl?: string | null; quantity: string; amount: string };

function supplierRows(g: ReceptionGroup<MarketplaceAplReceptionView>): TaskRow[] {
  return g.lines.map((l) => ({
    key: l.key,
    title: l.productName,
    imageUrl: l.imageUrl,
    quantity: receptionLineQuantity(l),
    amount: rub(l.amount),
  }));
}

// ── Акты поставки документами: «Показать акты» вместо таблицы позиций ──
// Поставщик подписывает акты приёма-передачи, поэтому видит их до подписи
// теми же документами, что на своём столе (SignAplReceptionDialog). Документы
// собираются по каждому акту группы; показ — вместо таблицы, итог и кнопки
// подписи остаются справа.
const actsHtml = ref<Record<string, string>>({});
const actsShown = ref<Record<string, boolean>>({});
const actsLoading = ref<string | null>(null);

async function toggleSupplierActs(g: ReceptionGroup<MarketplaceAplReceptionView>): Promise<void> {
  if (actsShown.value[g.key]) {
    actsShown.value = { ...actsShown.value, [g.key]: false };
    return;
  }
  if (!actsHtml.value[g.key]) {
    actsLoading.value = g.key;
    try {
      const parts: string[] = [];
      for (const r of g.receptions) {
        const payloads = await fetchSupplierSignablePayloads(r.id);
        parts.push(...payloads.map((p) => p.html));
      }
      actsHtml.value = { ...actsHtml.value, [g.key]: parts.join('<hr/>') };
    } catch (e) {
      FailAlert(e, t('marketplace.signAplReceptionDialog.buildActsFailedMessage'));
    } finally {
      actsLoading.value = null;
    }
  }
  if (actsHtml.value[g.key]) actsShown.value = { ...actsShown.value, [g.key]: true };
}

function supplierFacts(g: ReceptionGroup<MarketplaceAplReceptionView>): Array<{ label: string; value: string }> {
  const facts = [{ label: t('marketplace.onsiteSignatureGateOverlay.positionsLabel'), value: String(g.lines.length) }];
  if (g.ttnNumbers.length) facts.push({ label: t('marketplace.onsiteSignatureGateOverlay.ttnFactLabel'), value: g.ttnNumbers.join(', ') });
  return facts;
}

type ProposalTask = (typeof proposalTasks.value)[number];

function proposalRows(p: ProposalTask): TaskRow[] {
  return p.items.map((i) => ({
    key: i.offer_id,
    title: i.product_name,
    imageUrl: i.image_url,
    quantity: proposalItemQuantity(i),
    amount: rub(proposalLineCost(i)),
  }));
}

/**
 * Строки сводки получения (тексты согласованы владельцем 02.11.2026):
 * стоимость имущества и обеспечительная часть — всегда; возврат на свободный
 * паевой — если выдали меньше или дешевле заказа; «сверх внесённого при
 * заказе» — если больше или дороже. Источник денег (перевод с главного
 * паевого по заявлению) в сводке не показывается: он не складывается в
 * итог и путает (слово владельца 02.11.2026). Нулевых строк нет.
 */
function proposalLines(p: ProposalTask): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [
    { label: t('marketplace.onsiteSignatureGateOverlay.receivedCostLabel'), value: rub(p.total_cost) },
  ];
  if (feePercent.value > 0) {
    lines.push({ label: t('marketplace.onsiteSignatureGateOverlay.membershipFeeLabel', { percent: feePercent.value }), value: rub(proposalFeeAmount(p)) });
  }
  const diff = proposalDiffs.value[p.id];
  if (diff?.refund > 0) lines.push({ label: t('marketplace.onsiteSignatureGateOverlay.refundToWalletLabel'), value: rub(diff.refund) });
  if (diff?.surcharge > 0) lines.push({ label: t('marketplace.onsiteSignatureGateOverlay.surchargeFromShareLabel'), value: rub(diff.surcharge) });
  return lines;
}

type SagaTask = (typeof sagaTasks.value)[number];

function sagaRows(s: SagaTask): TaskRow[] {
  // Товар с названием и снимком; номер заказа — мета-строкой под ним.
  const orderLabel = t('marketplace.onsiteSignatureGateOverlay.orderNumberLabel', { orderId: s.order_id.slice(0, 8) });
  return [{
    key: String(s.id),
    title: s.product_name || orderLabel,
    meta: s.product_name ? orderLabel : undefined,
    imageUrl: s.image_url,
    quantity: String(s.fact.actual_quantity),
    amount: rub(s.fact.fact_cost),
  }];
}

const supplierBusy = (g: ReceptionGroup<MarketplaceAplReceptionView>) => signingKey.value === g.key;
const proposalBusy = (id: string) => signingKey.value === id;
const anySigning = computed(() => signingKey.value !== null);

/** Сага вне бандла: что именно подписываем — заявление или акт. */
function sagaTaskTitle(s: { stage: string }): string {
  return s.stage === 'FACT_FIXED' ? t('marketplace.onsiteSignatureGateOverlay.sagaTaskTitleStatement') : t('marketplace.onsiteSignatureGateOverlay.actLabel');
}
/** Надпись на кнопке саги: заявление — то же «подписать и получить», что и в бандле. */
function sagaTaskAction(s: { stage: string }): string {
  return s.stage === 'FACT_FIXED' ? t('marketplace.onsiteSignatureGateOverlay.signAndReceiveButton') : t('marketplace.onsiteSignatureGateOverlay.signActButton');
}
function sagaTaskSub(s: { stage: string }): string {
  return s.stage === 'FACT_FIXED'
    ? t('marketplace.onsiteSignatureGateOverlay.sagaTaskSubStatement')
    : t('marketplace.onsiteSignatureGateOverlay.sagaTaskSubAct');
}

// Первичная загрузка состояния при монтировании оверлея (он живёт всё время
// работы приложения). Дальше гейт обновляется по общей ленте изменений.
// realtime: нет источника в оверлее — гейт живёт по ленте для всего приложения (registerOnsiteGateLive при установке расширения), здесь только первая загрузка.
onMounted(() => {
  void refresh();
});

// Ставка взноса открыта только действующему пайщику, а оверлей смонтирован на
// всех страницах с первой секунды, включая вход и регистрацию: гость получал
// на этот запрос отказ 401, не принятый ещё пайщик — 403, и так при каждом
// открытии приложения. Запрашиваем ставку, когда пайщик действительно активен,
// один раз; неудачу повторим при следующей смене статуса.
const session = useSessionStore();
let feeRequested = false;
watch(
  () => session.isFullyActive,
  (active) => {
    if (!active || feeRequested) return;
    feeRequested = true;
    getMembershipFeePercent()
      .then((p) => (feePercent.value = p))
      .catch(() => {
        feeRequested = false; // нет ставки — сумму покажем без взноса
      });
  },
  { immediate: true },
);
</script>

<template lang="pug">
//- Идёт получение: обычное окно посередине экрана, а не полноэкранный холст —
//- ход дела одной карточкой, без кнопок (слово владельца 02.11.2026).
BaseDialog(
  :model-value='!!activeFlow',
  size='lg',
  :title='dialogTitle',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  .onsite-gate__flow
    p.onsite-gate__lead {{ $t('marketplace.onsiteSignatureGateOverlay.leadTextActive') }}
    .onsite-gate__head
      q-icon(v-if='flowStep === "done"', name='task_alt', size='28px')
      q-icon(v-else-if='flowStep === "declined"', name='block', size='28px')
      q-icon(v-else, name='inventory_2', size='28px')
      .onsite-gate__ident
        span.onsite-gate__name {{ flowTitle }}
        span.onsite-gate__sub {{ flowSub }}

    VerticalStepper(
      :steps='FLOW_STEPS',
      :active-key='flowActiveKey',
      :completed='flowCompleted',
      :errored='flowErrored'
    )
      template(#active)
        q-linear-progress.onsite-gate__bar(
          v-if='flowRunning',
          indeterminate,
          color='primary',
          track-color='grey-9',
          size='4px',
          rounded
        )

//- Задачи на подпись — рабочая страница на холсте, как окно приёмки у
//- оператора: шапка, затем по ряду на задачу — позиции слева, сводка с
//- итогом и подписью справа (общие компоненты актов).
BaseDialog(
  :model-value='isVisible && !activeFlow',
  :maximized='true',
  :canvas='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  ActDialogLayout(
    bare,
    :title='dialogTitle',
    :lead='`${$t("marketplace.onsiteSignatureGateOverlay.leadTextIdleLine1")} ${$t("marketplace.onsiteSignatureGateOverlay.leadTextIdleLine2")}`'
  )
    //- Поставщик: первая подпись акта приёмки (только очная доставка). До
    //- подписи на цепи ничего нет: «Отмена» откатывает черновик приёмки.
    ActWorkspaceRow(v-for='g in supplierTasks', :key='g.key')
      BaseCard
        template(#head)
          .onsite-gate__head
            q-icon(name='local_shipping', size='28px')
            .onsite-gate__ident
              span.onsite-gate__name {{ $t('marketplace.onsiteSignatureGateOverlay.supplyToKuLabel', { kuName: kuName(g.braname) }) }}
              span.onsite-gate__addr(v-if='kuAddr(g.braname)')
                q-icon(name='place', size='14px')
                | {{ kuAddr(g.braname) }}
              span.onsite-gate__sub {{ $t('marketplace.onsiteSignatureGateOverlay.confirmReceptionHint') }}
        //- Акты документами вместо таблицы — по кнопке «Показать акты» справа.
        .onsite-gate__acts(v-if='actsShown[g.key]', v-html='sanitizeDocumentHtml(actsHtml[g.key] ?? "")')
        ActLinesTable(v-else, :columns='readColumns', :rows='supplierRows(g)')
          template(#cell-item='{ row }')
            ActLineItem(:title='row.title', :image-url='row.imageUrl')
      template(#aside)
        ActSummaryCard(
          :eyebrow='$t("marketplace.onsiteSignatureGateOverlay.receptionActTitle")',
          :facts='supplierFacts(g)',
          :total-label='$t("marketplace.onsiteSignatureGateOverlay.totalToReceiveLabel")',
          :total='rub(g.totalAmount)'
        )
          template(#actions)
            BaseButton(
              block,
              variant='primary',
              :loading='supplierBusy(g)',
              :disabled='anySigning && !supplierBusy(g)',
              @click='signSupplier(g)'
            )
              template(#icon-left)
                q-icon(name='draw', size='18px')
              | {{ g.lines.some((l) => l.quantity > 0) ? $t('marketplace.onsiteSignatureGateOverlay.signSupplyButton') : $t('marketplace.onsiteSignatureGateOverlay.confirmCancelButton') }}
            BaseButton(
              v-if='g.lines.some((l) => l.quantity > 0)',
              block,
              variant='secondary',
              :loading='actsLoading === g.key',
              :disabled='anySigning',
              @click='toggleSupplierActs(g)'
            )
              template(#icon-left)
                q-icon(name='description', size='18px')
              | {{ actsShown[g.key] ? $t('marketplace.onsiteSignatureGateOverlay.hideActsButton') : $t('marketplace.onsiteSignatureGateOverlay.showActsButton') }}
            BaseButton(
              block,
              variant='ghost',
              :disabled='anySigning',
              @click='cancelSupplier(g)'
            ) {{ $t('marketplace.onsiteSignatureGateOverlay.cancelButton') }}

    //- Бандл выдачи: оператор зафиксировал факт — пайщик одним нажатием
    //- подписывает заявления о возврате паевого взноса имуществом; до подписи
    //- на цепи ничего нет, «Отмена» — отказ от бандла (оператор повторит).
    ActWorkspaceRow(v-for='p in proposalTasks', :key='p.id')
      BaseCard
        template(#head)
          .onsite-gate__head
            q-icon(name='inventory_2', size='28px')
            .onsite-gate__ident
              span.onsite-gate__name {{ $t('marketplace.onsiteSignatureGateOverlay.pickupPointLabel') }}
              span.onsite-gate__sub {{ $t('marketplace.onsiteSignatureGateOverlay.pickupPointHint') }}
        p.onsite-gate__hint
          | {{ $t('marketplace.onsiteSignatureGateOverlay.reservedFundsHintLine1') }}
          |  {{ $t('marketplace.onsiteSignatureGateOverlay.reservedFundsHintLine2') }}
        ActLinesTable(:columns='readColumns', :rows='proposalRows(p)')
          template(#cell-item='{ row }')
            ActLineItem(:title='row.title', :image-url='row.imageUrl')
      template(#aside)
        ActSummaryCard(
          :eyebrow='$t("marketplace.onsiteSignatureGateOverlay.issueActTitle")',
          :lines='proposalLines(p)',
          :total-label='$t("marketplace.onsiteSignatureGateOverlay.totalReceivedLabel")',
          :total='rub(proposalTotalWithFee(p))'
        )
          template(#actions)
            BaseButton(
              block,
              variant='primary',
              :loading='proposalBusy(p.id)',
              :disabled='anySigning && !proposalBusy(p.id)',
              @click='signProposal(p)'
            )
              template(#icon-left)
                q-icon(name='draw', size='18px')
              | {{ $t('marketplace.onsiteSignatureGateOverlay.signAndReceiveButton') }}
            BaseButton(
              block,
              variant='ghost',
              :disabled='anySigning',
              @click='declineProposal(p)'
            ) {{ $t('marketplace.onsiteSignatureGateOverlay.cancelButton') }}

    //- Сага вне бандла: заявление (факт зафиксирован) либо акт после решения
    //- совета, пришедшего когда пайщик уже ушёл. Подписывается где угодно.
    ActWorkspaceRow(v-for='s in sagaTasks', :key='String(s.id)')
      BaseCard
        template(#head)
          .onsite-gate__head
            q-icon(name='assignment_turned_in', size='28px')
            .onsite-gate__ident
              span.onsite-gate__name {{ sagaTaskTitle(s) }}
              span.onsite-gate__sub {{ sagaTaskSub(s) }}
        ActLinesTable(:columns='readColumns', :rows='sagaRows(s)')
          template(#cell-item='{ row }')
            ActLineItem(:title='row.title', :meta='row.meta', :image-url='row.imageUrl')
      template(#aside)
        ActSummaryCard(
          :eyebrow='sagaTaskTitle(s)',
          :total-label='$t("marketplace.onsiteSignatureGateOverlay.totalReceivedLabel")',
          :total='rub(s.fact.fact_cost)'
        )
          template(#actions)
            BaseButton(
              block,
              variant='primary',
              :loading='proposalBusy(String(s.id))',
              :disabled='anySigning && !proposalBusy(String(s.id))',
              @click='signSaga(s)'
            )
              template(#icon-left)
                q-icon(name='draw', size='18px')
              | {{ sagaTaskAction(s) }}
</template>

<style scoped lang="scss">
.onsite-gate {
  // Ход получения в обычном окне: подсказка, шапка дела и шаги столбиком.
  &__flow {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__lead {
    margin: 0;
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.45;
    color: var(--p-ink-3);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;

    .q-icon {
      flex: 0 0 auto;
      color: var(--p-primary);
    }
  }

  &__ident {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__addr {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    overflow-wrap: anywhere;

    .q-icon {
      flex: 0 0 auto;
      color: var(--p-ink-3);
    }
  }

  &__sub {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  // Акты документами: читаются в карточке, длинные — с прокруткой.
  &__acts {
    max-height: 65vh;
    overflow: auto;
  }

  &__hint {
    margin: 0;
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
    color: var(--p-ink-2);
  }

  // Полоса под активным шагом: дело движется, даже если ответ идёт секунды.
  &__bar {
    margin-top: var(--p-2, 8px);
    max-width: 320px;
  }
}
</style>
