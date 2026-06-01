<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Loading } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseBadge, BaseButton, BaseDialog, BaseInput, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { QrScanner } from 'src/widgets/Marketplace/QrScanner';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { decodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import {
  listShipmentsByBraname,
  type MarketplaceShipmentView,
} from '../../OperatorIncomingShipments/api';
import {
  createAplReception,
  createExpressReception,
  listAplReceptionsByBraname,
  listExpressPickupsByBraname,
  listSupplierPickupOrders,
  type MarketplaceAplReceptionView,
  type MarketplaceExpressPickupCandidateView,
  type MarketplaceSupplierPickupOrderView,
} from '../api';
import SignAplReceptionChairmanDialog from './SignAplReceptionChairmanDialog.vue';

/**
 * Story 5.3 + 5.4 + Эпик 14: operator-стол приёмки партий.
 *
 * Оператор не вводит идентификатор партии руками — он либо выбирает
 * ожидающую приёмки партию из списка (партии `SUPPLY_PREPARED`, прибывшие
 * на его КУ), либо сканирует QR поставщика (Story 14.3). Все пути ведут в
 * единый диалог коррекции (`openPickupForSupplier`): оператор сверяет факт,
 * правит количество и цену по каждой единице и только потом формирует акт —
 * коррекция доступна ВСЕГДА и без исключений (ревью 2026-05-30). Без формы
 * сверки нельзя: иначе риск «приняли как заказано, хотя привезли меньше».
 *
 * Story 14.2: отдельный раздел «Самовывоз по факту» — поставщики с принятыми
 * заказами, которые не формировали партию заранее. Оператор принимает по факту
 * присутствия: `createExpressReception({ offerer_account, braname })` синтезирует
 * партию самовывоза и открывает по ней приёмку.
 */

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceAplReceptionView[]>([]);
const expectedShipments = ref<MarketplaceShipmentView[]>([]);
// Story 14.2: поставщики с принятыми заказами, ожидающими самовывоза на КУ
// (партию заранее не формировали) — приёмка по факту присутствия.
const expressCandidates = ref<MarketplaceExpressPickupCandidateView[]>([]);
// Состав ожидаемого имущества по поставщику (для карточек «что везут» без
// проваливания): грузим единицы поставщиков, чьи партии/самовывоз ждут приёмки.
const ordersByOfferer = ref<Record<string, MarketplaceSupplierPickupOrderView[]>>({});
const loading = ref(false);

// Партии, прибывшие на КУ и ожидающие создания акта приёмки: статус
// SUPPLY_PREPARED (после создания акта партия уходит в RECEPTION_IN_PROGRESS).
const pendingShipments = computed(() =>
  expectedShipments.value.filter(
    (s) => s.status === Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED,
  ),
);

const SHIPMENT_VARIANT_LABEL: Record<string, string> = {
  SELF: 'Поставщик лично',
  EXPEDITOR: 'Экспедитор по ТТН',
  A: 'Поставщик лично',
  B: 'Экспедитор по ТТН',
};

const RECEPTION_STATUS_LABEL: Record<string, string> = {
  PENDING_SUPPLIER_SIGN: 'Ждёт подписи поставщика',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'Ждёт подписи председателя',
  ACCEPTED_TO_COOP: 'Принят кооперативом',
  CANCELLED: 'Отменён',
};

const RECEPTION_STATUS_VARIANT: Record<string, BaseBadgeVariant> = {
  PENDING_SUPPLIER_SIGN: 'neutral',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'warn',
  ACCEPTED_TO_COOP: 'pos',
  CANCELLED: 'neg',
};

const RECEPTION_VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};

// Ждущие подписи приёмки — наверх: председатель приходит на стол, чтобы
// подписать акты, а не листать уже принятые партии.
const STATUS_SORT_PRIORITY: Record<string, number> = {
  PENDING_CHAIRMAN_RECEPTION_SIGN: 0,
  PENDING_SUPPLIER_SIGN: 1,
  ACCEPTED_TO_COOP: 2,
  CANCELLED: 3,
};

function statusLabel(v: string): string {
  return RECEPTION_STATUS_LABEL[v] ?? v;
}

function statusVariant(v: string): BaseBadgeVariant {
  return RECEPTION_STATUS_VARIANT[v] ?? 'neutral';
}

const columns: QTableProps['columns'] = [
  { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },
  { name: 'variant', label: 'Вариант', field: 'variant', align: 'center', format: (v: string) => RECEPTION_VARIANT_LABEL[v] ?? v },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' },
  {
    name: 'total_amount',
    label: 'Сумма',
    field: 'total_amount',
    align: 'right',
    format: (v: unknown) => `${formatAsset2Digits(String(v ?? ''))} ₽`,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    const [receptions, shipments, express] = await Promise.all([
      listAplReceptionsByBraname({ braname: braname.value.trim() }),
      listShipmentsByBraname({ braname: braname.value.trim() }),
      listExpressPickupsByBraname({ braname: braname.value.trim() }),
    ]);
    items.value = [...receptions].sort(
      (a, b) =>
        (STATUS_SORT_PRIORITY[a.status] ?? 99) - (STATUS_SORT_PRIORITY[b.status] ?? 99),
    );
    expectedShipments.value = shipments;
    expressCandidates.value = express;
    await loadOffererContents();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты приёмки');
  } finally {
    loading.value = false;
  }
}

// Состав того, что ждёт приёмки, — для карточек «что везут». Грузим единицы
// имущества по каждому поставщику, чья партия (SUPPLY_PREPARED) или самовывоз
// ждёт на этом КУ. Сетевая нагрузка ограничена числом поставщиков на приёмке.
async function loadOffererContents(): Promise<void> {
  const offerers = new Set<string>();
  for (const s of expectedShipments.value) {
    if (s.status === Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED) offerers.add(s.offerer_account);
  }
  for (const c of expressCandidates.value) offerers.add(c.offerer_account);
  const map: Record<string, MarketplaceSupplierPickupOrderView[]> = {};
  await Promise.all(
    [...offerers].map(async (account) => {
      try {
        map[account] = await listSupplierPickupOrders({
          braname: braname.value.trim(),
          offerer_account: account,
        });
      } catch {
        map[account] = [];
      }
    }),
  );
  ordersByOfferer.value = map;
}

// Состав партии (задекларированные единицы по shipment_id).
function shipmentContents(s: MarketplaceShipmentView): MarketplaceSupplierPickupOrderView[] {
  return (ordersByOfferer.value[s.offerer_account] ?? []).filter((o) => o.shipment_id === s.id);
}

// Состав самовывоза по факту (добор по акцепту — без партии).
function expressContents(c: MarketplaceExpressPickupCandidateView): MarketplaceSupplierPickupOrderView[] {
  return (ordersByOfferer.value[c.offerer_account] ?? []).filter((o) => o.status === 'ACCEPTED');
}

// QR-код передачи (Эпик 14, агрегирующая приёмка): оператор сканирует
// account-bound код поставщика → грузим ВСЕ единицы имущества этого поставщика,
// ожидающие приёмки на этом КУ (единый базис «акцепт поставщика на КУ», R4),
// и открываем агрегирующую страницу приёмки.
const scanDialogOpen = ref(false);
const pickupDialogOpen = ref(false);
const pickupAccount = ref('');
// Режим приёмки по ТТН экспедитора: id партии из shipment-bound QR. null —
// приёмка по account-коду поставщика (грузим всё имущество + добор).
const pickupShipmentId = ref<string | null>(null);
// Наименование поставщика (ФИО/организация) для заголовка приёмки — из заказов.
const pickupSupplierName = ref('');
const pickupOrders = ref<MarketplaceSupplierPickupOrderView[]>([]);
// Факт по позиции, вводится на приёмке (R5): по умолчанию = заказано; потолок = заказано.
const pickupFact = ref<Record<string, number>>({});
// Фактическая цена за единицу, корректируется оператором на приёмке (B2):
// по умолчанию = цена заказа (привезли хуже → принимаем со скидкой).
const pickupPrice = ref<Record<string, string>>({});
// Выбранные к приёмке единицы (R7). Снятая галка = не принимаем эту единицу;
// если по партии не выбрано ни одной единицы — партия не создаётся и ждёт
// (кейс экспедитора: одна партия здесь, другая ещё в пути).
const selectedOrderIds = ref<Set<string>>(new Set());
// Принимать ли добор по акцепту (ACCEPTED-заказы без партии) одним самовывозом.
const takeAddon = ref(true);

// Плоский список единиц имущества двумя секциями (R7a): задекларированные в
// партии (по ТТН) — статус SUPPLY_PREPARED; добор по акцепту — статус ACCEPTED.
const declaredOrders = computed(() =>
  pickupOrders.value.filter((o) => o.status === 'SUPPLY_PREPARED'),
);
const addonOrders = computed(() =>
  pickupOrders.value.filter((o) => o.status === 'ACCEPTED'),
);

// Заголовок диалога приёмки: режим ТТН экспедитора vs приёмка по коду поставщика.
const pickupDialogTitle = computed(() =>
  pickupShipmentId.value ? 'Приёмка партии по ТТН экспедитора' : 'Приёмка имущества поставщика',
);

// Партия (shipment) задекларированной единицы — по прямой связи order.shipment_id
// (обязательно при нескольких частичных партиях на одном КУ).
function shipmentForOrder(o: MarketplaceSupplierPickupOrderView): MarketplaceShipmentView | null {
  return pendingShipments.value.find((s) => s.id === o.shipment_id) ?? null;
}

function isSelected(id: string): boolean {
  return selectedOrderIds.value.has(id);
}
function toggleOrder(id: string, value: boolean): void {
  const next = new Set(selectedOrderIds.value);
  if (value) next.add(id);
  else next.delete(id);
  selectedOrderIds.value = next;
}

// Потолок факта = заказано (акцепт): сверх акцепта не принимаем (R5).
function clampFact(orderId: string, ordered: number): void {
  const v = Number(pickupFact.value[orderId]);
  if (!Number.isFinite(v) || v < 0) pickupFact.value[orderId] = 0;
  else if (v > ordered) pickupFact.value[orderId] = ordered;
  else pickupFact.value[orderId] = Math.trunc(v);
}

// Сколько актов будет создано: по одному на каждую партию с ≥1 выбранной
// единицей + один на добор (если принимаем и он есть).
const plannedReceptionsCount = computed(() => {
  const shipments = new Set<string>();
  for (const o of declaredOrders.value) {
    if (o.shipment_id && selectedOrderIds.value.has(o.id)) shipments.add(o.shipment_id);
  }
  return shipments.size + (takeAddon.value && addonOrders.value.length ? 1 : 0);
});

// Единая точка открытия диалога приёмки по поставщику (QR-скан и «самовывоз по
// факту» ведут сюда): грузим все единицы имущества поставщика на этом КУ и
// открываем форму коррекции количества/цены.
async function openPickupForSupplier(account: string): Promise<void> {
  Loading.show({ message: 'Загружаю имущество поставщика…' });
  try {
    const orders = await listSupplierPickupOrders({
      braname: braname.value.trim(),
      offerer_account: account,
    });
    if (!orders.length) {
      FailAlert(
        new Error(`У поставщика ${account} нет имущества, ожидающего приёмки на этом пункте.`),
      );
      return;
    }
    pickupShipmentId.value = null;
    pickupAccount.value = account;
    pickupSupplierName.value = orders[0]?.supplier_name ?? '';
    pickupOrders.value = orders;
    pickupFact.value = Object.fromEntries(orders.map((o) => [o.id, o.quantity]));
    pickupPrice.value = Object.fromEntries(orders.map((o) => [o.id, o.price_per_unit]));
    selectedOrderIds.value = new Set(orders.map((o) => o.id));
    takeAddon.value = true;
    pickupDialogOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить имущество поставщика');
  } finally {
    Loading.hide();
  }
}

// Приёмка по ТТН экспедитора (shipment-bound QR): грузим состав СТРОГО одной
// партии. Экспедитор не пайщик — добора по акцепту нет, принимаем только то,
// что в накладной (R: «ничего больше там отображаться не должно»).
async function openPickupForShipment(shipment_id: string): Promise<void> {
  const shipment = pendingShipments.value.find((s) => s.id === shipment_id);
  if (!shipment) {
    FailAlert(
      new Error(
        'Партия по этой ТТН не найдена среди ожидающих приёмки на вашем КУ ' +
          '(возможно, уже принята или направлена на другой участок).',
      ),
    );
    return;
  }
  Loading.show({ message: 'Загружаю состав партии…' });
  try {
    const all = await listSupplierPickupOrders({
      braname: braname.value.trim(),
      offerer_account: shipment.offerer_account,
    });
    const orders = all.filter((o) => o.shipment_id === shipment_id);
    if (!orders.length) {
      FailAlert(new Error('В партии нет позиций, ожидающих приёмки (возможно, уже принята).'));
      return;
    }
    pickupShipmentId.value = shipment_id;
    pickupAccount.value = shipment.offerer_account;
    pickupSupplierName.value = orders[0]?.supplier_name ?? '';
    pickupOrders.value = orders;
    pickupFact.value = Object.fromEntries(orders.map((o) => [o.id, o.quantity]));
    pickupPrice.value = Object.fromEntries(orders.map((o) => [o.id, o.price_per_unit]));
    selectedOrderIds.value = new Set(orders.map((o) => o.id));
    takeAddon.value = false;
    pickupDialogOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить состав партии');
  } finally {
    Loading.hide();
  }
}

async function onQrScanned(code: string): Promise<void> {
  scanDialogOpen.value = false;
  const token = decodeHandoffToken(code);
  if (!token) {
    FailAlert(
      new Error('Нераспознанный код. Отсканируйте «Мой код для ПВЗ» поставщика или QR с ТТН экспедитора.'),
    );
    return;
  }
  if (token.coopname && token.coopname !== coopname.value) {
    FailAlert(new Error('Код выписан для другого кооператива.'));
    return;
  }
  if (token.kind === HandoffTokenKind.Shipment && token.shipment_id) {
    await openPickupForShipment(token.shipment_id);
    return;
  }
  if (token.kind === HandoffTokenKind.Pickup) {
    await openPickupForSupplier(token.account);
    return;
  }
  FailAlert(new Error('Этот код не предназначен для приёмки на ПВЗ.'));
}

// Сформировать акты приёмки по выбранному: на каждую партию с выбранными
// единицами — createAplReception с фактическим кол-вом per-Order (R5; невыбранные
// единицы партии = 0, потолок = заказано). Не выбранные целиком партии остаются
// ждать. Добор по акцепту — express-самовывозом.
async function acceptPickup(): Promise<void> {
  pickupDialogOpen.value = false;
  Loading.show({ message: 'Формирую акты приёмки…' });
  let created = 0;
  try {
    // Задекларированные единицы → по партиям (shipment_id); партию без выбранных
    // единиц пропускаем (она ждёт). Связь по shipment_id обязательна при
    // нескольких частичных партиях на одном КУ — группировка по cycle_id брала бы
    // не ту партию.
    const byShipment = new Map<string, MarketplaceSupplierPickupOrderView[]>();
    for (const o of declaredOrders.value) {
      if (!o.shipment_id) continue;
      const arr = byShipment.get(o.shipment_id) ?? [];
      arr.push(o);
      byShipment.set(o.shipment_id, arr);
    }
    for (const [shipment_id, orders] of byShipment) {
      const anySelected = orders.some((o) => selectedOrderIds.value.has(o.id));
      if (!anySelected) continue;
      await createAplReception({
        shipment_id,
        fact_quantity_per_order: orders.map((o) => ({
          order_id: o.id,
          fact_quantity: selectedOrderIds.value.has(o.id) ? pickupFact.value[o.id] ?? o.quantity : 0,
          fact_unit_price: pickupPrice.value[o.id] ?? o.price_per_unit,
        })),
      });
      created += 1;
    }
    // Добор по акцепту — самовывозом (принимается весь добор поставщика на КУ)
    // с фактическим количеством и ценой по каждой единице (B2/R5).
    if (takeAddon.value && addonOrders.value.length) {
      const result = await createExpressReception({
        offerer_account: pickupAccount.value,
        braname: braname.value.trim(),
        fact_quantity_per_order: addonOrders.value.map((o) => ({
          order_id: o.id,
          fact_quantity: pickupFact.value[o.id] ?? o.quantity,
          fact_unit_price: pickupPrice.value[o.id] ?? o.price_per_unit,
        })),
      });
      created += result.apl_receptions.length;
    }
    SuccessAlert(created > 1 ? `Создано актов приёмки: ${created}` : 'Акт приёмки создан');
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать часть актов — проверьте ленту и повторите');
  } finally {
    Loading.hide();
    pickupOrders.value = [];
    await load();
  }
}

const signDialogOpen = ref(false);
const signTarget = ref<MarketplaceAplReceptionView | null>(null);

function signChairman(item: MarketplaceAplReceptionView): void {
  signTarget.value = item;
  signDialogOpen.value = true;
}

async function onChairmanSigned(): Promise<void> {
  await load();
}

watch(braname, () => void load());

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});
</script>

<template lang="pug">
q-page.reception(role='region', aria-label='Приёмка партии')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Приёмка партий доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    //- Действие страницы — в шапку (канон Teleport): сканирование QR-кода
    //- передачи (код поставщика / ТТН экспедитора) всегда в одном месте сверху.
    Teleport(to="#header-actions-host", defer)
      BaseButton(variant='primary', size='sm', @click='scanDialogOpen = true')
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | Сканировать QR

    PageHint(storage-key='mp:operator-reception:banner-dismissed')
      | Партии, прибывшие на ваш пункт выдачи, и их состав — ниже. Приёмка
      | запускается ТОЛЬКО сканированием QR поставщика (или вводом кода) —
      | кнопка «Сканировать QR» в шапке. Это идентификация: без кода принять
      | нельзя, даже если знаете человека в лицо. Затем сверьте факт по
      | позициям, сформируйте акт и подпишите его председателем участка.

    //- Ожидающие приёмки партии — информационные карточки «что везут».
    //- Запуск приёмки — только через скан QR/ввод кода (кнопка в шапке).
    .reception__pending
      .reception__pending-head
        .reception__pending-title Ожидают приёмки

      .reception__empty(v-if='!pendingShipments.length') Нет партий, ожидающих приёмки на этом КУ.

      .reception__ship(v-for='s in pendingShipments', :key='s.id')
        .reception__ship-info
          .reception__ship-offerer {{ s.offerer_account }}
          .reception__ship-meta
            | {{ SHIPMENT_VARIANT_LABEL[s.delivery_variant] ?? s.delivery_variant }} · {{ formatAsset2Digits(s.total_amount) }} ₽
            template(v-if='s.ttn_number')  · ТТН {{ s.ttn_number }}
          ul.reception__contents(v-if='shipmentContents(s).length')
            li.reception__content-line(v-for='o in shipmentContents(s)', :key='o.id')
              | {{ o.product_name || 'Товар по предложению' }} — {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}

    //- Story 14.2: самовывоз по факту — поставщик приехал без заранее
    //- сформированной партии. Тоже только через скан QR/ввод кода.
    .reception__pending(v-if='expressCandidates.length')
      .reception__pending-head
        .reception__pending-title Самовывоз по факту (без партии)

      .reception__ship(v-for='c in expressCandidates', :key='c.offerer_account')
        .reception__ship-info
          .reception__ship-offerer {{ c.offerer_account }}
          .reception__ship-meta
            | Самовывоз · {{ c.orders_count }} заказ(ов) · {{ c.total_units }} ед. · {{ formatAsset2Digits(c.total_amount) }} ₽
          ul.reception__contents(v-if='expressContents(c).length')
            li.reception__content-line(v-for='o in expressContents(c)', :key='o.id')
              | {{ o.product_name || 'Товар по предложению' }} — {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}

    q-table.reception__table(
      :rows='items',
      :columns='columns',
      row-key='id',
      flat,
      bordered,
      :loading='loading'
    )
      template(#body-cell-status='props')
        q-td(:props='props')
          BaseBadge(:variant='statusVariant(props.row.status)') {{ statusLabel(props.row.status) }}

      template(#body-cell-actions='props')
        q-td(:props='props')
          BaseButton(
            v-if='props.row.status === "PENDING_CHAIRMAN_RECEPTION_SIGN"',
            variant='primary',
            size='sm',
            @click='signChairman(props.row)'
          )
            template(#icon-left)
              q-icon(name='draw', size='16px')
            | Подписать председателем

      template(#no-data)
        .reception__nodata
          EmptyState(
            title='Актов приёмки нет',
            body='Выберите прибывшую партию выше и создайте акт — он появится здесь для подписания.'
          )
            template(#icon)
              q-icon(name='assignment_turned_in', size='48px')

  SignAplReceptionChairmanDialog(
    v-model='signDialogOpen',
    :reception='signTarget',
    @signed='onChairmanSigned'
  )

  BaseDialog(v-model='scanDialogOpen', title='Сканирование QR партии', size='sm')
    QrScanner(@scanned='onQrScanned')

  //- Эпик 14: агрегирующая приёмка по account-bound коду. Плоский список единиц
  //- имущества (R7a): сверху — задекларированные в партии (по ТТН), ниже
  //- разделитель и добор по акцепту. Факт правится на месте, потолок = заказано (R5).
  BaseDialog(v-model='pickupDialogOpen', :title='pickupDialogTitle', maximized)
    .reception__pickup
      .reception__pickup-account {{ pickupSupplierName || pickupAccount }}
      .reception__pickup-hint
        | По каждой единице скорректируйте фактическое количество (не выше
        | заказанного) и цену. Снимите галку с задекларированной единицы, чтобы
        | не принимать её; партия без выбранных единиц не создаётся и ждёт.

      template(v-if='declaredOrders.length')
        .reception__pickup-section Задекларировано в партии (по ТТН)
        .reception__unit(v-for='o in declaredOrders', :key='o.id', :class='{ "reception__unit--off": !isSelected(o.id) }')
          q-checkbox(
            :model-value='isSelected(o.id)',
            dense,
            @update:model-value='(v) => toggleOrder(o.id, v)'
          )
          .reception__unit-info
            .reception__unit-title {{ o.product_name || 'Товар по предложению' }}
            .reception__unit-meta
              | Заказано {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
              template(v-if='shipmentForOrder(o)?.ttn_number')  · ТТН {{ shipmentForOrder(o)?.ttn_number }}
          .reception__unit-fact
            BaseInput(
              v-model.number='pickupFact[o.id]',
              type='number',
              dense,
              :disable='!isSelected(o.id)',
              :suffix='marketplaceUnitShort(o.unit_of_measure)',
              @blur='clampFact(o.id, o.quantity)'
            )
            BaseInput(
              v-model='pickupPrice[o.id]',
              type='number',
              dense,
              :disable='!isSelected(o.id)',
              label='Цена/ед.'
            )

      template(v-if='addonOrders.length')
        .reception__pickup-divider
        .reception__pickup-section-row
          .reception__pickup-section Добор по акцепту (вне партии)
          q-checkbox(v-model='takeAddon', dense, label='Принять добор')
        .reception__unit.reception__unit--addon(v-for='o in addonOrders', :key='o.id', :class='{ "reception__unit--off": !takeAddon }')
          q-icon(name='add_circle_outline', size='16px')
          .reception__unit-info
            .reception__unit-title {{ o.product_name || 'Товар по предложению' }}
            .reception__unit-meta Акцептовано {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
          .reception__unit-fact
            BaseInput(
              v-model.number='pickupFact[o.id]',
              type='number',
              dense,
              :disable='!takeAddon',
              :suffix='marketplaceUnitShort(o.unit_of_measure)',
              @blur='clampFact(o.id, o.quantity)'
            )
            BaseInput(
              v-model='pickupPrice[o.id]',
              type='number',
              dense,
              :disable='!takeAddon',
              label='Цена/ед.'
            )

      .reception__pickup-actions
        BaseButton(variant='ghost', size='sm', @click='pickupDialogOpen = false') Отмена
        BaseButton(variant='primary', size='sm', :disabled='!plannedReceptionsCount', @click='acceptPickup')
          template(#icon-left)
            q-icon(name='how_to_reg', size='16px')
          | Сформировать акты ({{ plannedReceptionsCount }})
</template>

<style scoped lang="scss">
.reception {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // #no-data слот q-table выравнивает контент влево — центрируем EmptyState.
  &__nodata {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  &__pending {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-4, 16px);
  }

  &__pending-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__pending-title {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__empty {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    padding: var(--p-2, 8px) 0;
  }

  &__ship {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__ship-info {
    min-width: 0;
  }

  &__ship-offerer {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__ship-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  &__contents {
    margin: var(--p-2, 8px) 0 0;
    padding-left: var(--p-4, 16px);
    list-style: disc;
  }

  &__content-line {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__pickup {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__pickup-account {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--font-mono);
  }

  &__pickup-hint {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    margin-bottom: var(--p-2, 8px);
  }

  &__pickup-section {
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__pickup-section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__pickup-divider {
    height: 1px;
    background: var(--p-line);
    margin: var(--p-3, 12px) 0 var(--p-1, 4px);
  }

  &__pickup-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    margin-top: var(--p-3, 12px);
  }

  &__unit {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);

    &--off {
      opacity: 0.5;
    }
  }

  &__unit-info {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__unit-title {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__unit-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__unit-fact {
    flex: 0 0 auto;
    width: 120px;
  }
}

@media (max-width: 768px) {
  .reception {
    padding: var(--p-4, 16px);

    &__ship {
      flex-direction: column;
      align-items: stretch;
    }
  }
}
</style>
