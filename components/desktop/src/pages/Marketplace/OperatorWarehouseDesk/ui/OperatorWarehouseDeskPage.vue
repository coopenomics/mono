<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { OperatorBranchBar } from 'src/entities/OperatorBranch'
import { useDesktopStore } from 'src/entities/Desktop'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { OperatorInventoryLabelingSection } from 'src/pages/Marketplace/OperatorInventoryLabeling'
import { OperatorOwnWarehouseSection } from 'src/pages/Marketplace/OperatorOwnWarehouse'
import { OperatorContainersSection } from 'src/pages/Marketplace/OperatorContainers'
import { PvzWriteoffsSection } from 'src/pages/Marketplace/PvzWriteoffs'
import { listWriteoffPendingConfirmations } from 'src/pages/Marketplace/PvzWriteoffs/api'
import { listStock } from 'src/pages/Marketplace/OperatorOwnWarehouse/api'
import {
  MARKETPLACE_ON_WAREHOUSE_STATUSES,
  listInventory,
} from 'src/entities/MarketplaceInventory'
import { useMarketplaceStorageStore } from 'src/entities/MarketplaceStorage'
import { useOperatorBranchStore } from 'src/entities/OperatorBranch'

/**
 * Стол «Склад» — всё складское хозяйство участка одной страницей.
 *
 * Раскладка, склад, обезличенный остаток, списание и боксы раньше жили
 * отдельными пунктами меню, хотя это одна и та же сущность с разных сторон:
 * карта склада, что на ней лежит, что с неё выбывает и тара, в которой оно
 * лежит. Меню от этого пухло, а боксы заводят однажды и потом не открывают
 * месяцами.
 *
 * Открывается на раскладке — это ежедневная работа оператора; остальные
 * разделы рядом, за один клик.
 */

// Типы боксов уехали на стол администратора (решение владельца 14.09.2026):
// габариты тары общие на весь кооператив, участок только берёт готовый тип
// при заведении боксов. Здесь остались сами боксы участка.
const SECTIONS = ['labeling', 'warehouse', 'stock', 'writeoffs', 'containers'] as const
type WarehouseSection = (typeof SECTIONS)[number]

const DEFAULT_SECTION: WarehouseSection = 'labeling'

const route = useRoute()
const router = useRouter()
const desktop = useDesktopStore()
const branchStore = useOperatorBranchStore()
const storage = useMarketplaceStorageStore()

/** Раздел живёт в адресе: ссылку на нужную вкладку можно послать коллеге. */
const activeSection = computed<WarehouseSection>(() => {
  const raw = String(route.params.section ?? '')
  if ((SECTIONS as readonly string[]).includes(raw)) return raw as WarehouseSection
  // Ссылка на прежний раздел типов тары ведёт к боксам: сам справочник уехал
  // на стол администратора, но старые закладки не должны падать на раскладку.
  if (raw === 'types') return 'containers'
  return DEFAULT_SECTION
})

// Боксы — контур необязательный: когда кооператив его не включил, backend не
// выдаёт право на управление тарой, и оба справочника прячутся.
const containersAllowed = computed(() =>
  desktop.hasGrant('market-pvz', 'Container:manage:own-KU'),
)

// Списание подтверждает председатель участка — у оператора без этого права
// раздела нет.
const writeoffsAllowed = computed(() =>
  desktop.hasGrant('market-pvz', 'Writeoff:read:own-KU'),
)

/**
 * Счётчики разделов. `null` — «ещё не считали»: показать ноль там, где на
 * самом деле десять боксов, хуже, чем не показать ничего (жалоба 2026-09-14:
 * «Боксы 0», а внутри десять). Число появляется, когда оно известно.
 */
const counts = ref<Record<'warehouse' | 'stock' | 'writeoffs' | 'containers', number | null>>({
  warehouse: null,
  stock: null,
  writeoffs: null,
  containers: null,
})

const tabs = computed<PageTab[]>(() => {
  const list: PageTab[] = [
    { key: 'labeling', label: 'Раскладка и маркировка' },
    // Раздел называется «Имущество», а не «Склад»: страница целиком про склад,
    // и вкладка с тем же словом внутри неё ничего не различала.
    { key: 'warehouse', label: 'Имущество', count: counts.value.warehouse ?? undefined },
    { key: 'stock', label: 'Остатки', count: counts.value.stock ?? undefined },
  ]
  if (writeoffsAllowed.value) {
    list.push({
      key: 'writeoffs',
      label: 'Списание',
      count: counts.value.writeoffs ?? undefined,
    })
  }
  if (containersAllowed.value) {
    list.push({
      key: 'containers',
      label: 'Боксы',
      count: counts.value.containers ?? undefined,
    })
  }
  return list
})

function onSelectTab(tab: PageTab): void {
  void router.replace({
    name: 'marketplace-pvz-warehouse',
    params: { coopname: route.params.coopname, section: tab.key },
  })
}

// Право на раздел может отозваться, пока оператор в нём стоит, — тогда
// возвращаем его на раскладку, чтобы он не смотрел в пустой экран.
watch([containersAllowed, writeoffsAllowed, activeSection], ([containers, writeoffs, section]) => {
  const lost = (!containers && section === 'containers') || (!writeoffs && section === 'writeoffs')
  if (!lost) return
  void router.replace({
    name: 'marketplace-pvz-warehouse',
    params: { coopname: route.params.coopname, section: DEFAULT_SECTION },
  })
})

function onWarehouseCounts(value: { warehouse: number; stock: number }): void {
  counts.value = { ...counts.value, ...value }
}

function onContainerCounts(value: { containers: number }): void {
  counts.value = { ...counts.value, ...value }
}

function onWriteoffCount(value: number): void {
  counts.value = { ...counts.value, writeoffs: value }
}

/**
 * Счётчик списаний считается при открытии стола, а не при заходе в раздел.
 * Разделы монтируются по одному, поэтому бейдж «Списание» стоял нулём, пока
 * председатель туда не заглянет, — и подтверждения выглядели как «делать
 * нечего» (жалоба 2026-08-13: на повестке ждёт подтверждения склада, а на
 * складе ноль). Раздел, когда его откроют, пришлёт своё число событием и
 * заменит это.
 */
async function loadWriteoffCount(): Promise<void> {
  if (!writeoffsAllowed.value) return
  try {
    const groups = await listWriteoffPendingConfirmations()
    counts.value = { ...counts.value, writeoffs: groups.length }
  } catch {
    // Счётчик — подсказка, а не содержимое: молча оставляем прежнее значение.
  }
}

/**
 * Остальные счётчики — тем же порядком: стол считает их при открытии, а не при
 * заходе в раздел. Разделы монтируются по одному, поэтому до первого захода в
 * «Боксы» полоса честно писала ноль при десяти заведённых боксах.
 *
 * Боксы стор кеширует (`ensureLoaded`), так что раздел, когда его откроют,
 * второй раз за ними не пойдёт; склад и остаток он перечитает сам и пришлёт
 * своё число событием.
 */
async function loadSectionCounts(): Promise<void> {
  const bran = branchStore.activeBraname
  if (!bran) return

  const [warehouse, stock] = await Promise.allSettled([
    listInventory({ braname: bran, statuses: [...MARKETPLACE_ON_WAREHOUSE_STATUSES] }),
    listStock(),
    containersAllowed.value
      ? storage.ensureLoaded(bran)
      : Promise.resolve(),
  ])

  if (warehouse.status === 'fulfilled') {
    counts.value = { ...counts.value, warehouse: warehouse.value.length }
  }
  if (stock.status === 'fulfilled') {
    counts.value = { ...counts.value, stock: stock.value.length }
  }
  if (containersAllowed.value) {
    counts.value = { ...counts.value, containers: storage.activeContainers.length }
  }
}

onMounted(() => {
  void loadWriteoffCount()
  void loadSectionCounts()
})

// Право может прийти позже загрузки стола (grants подтягиваются асинхронно) —
// тогда считаем в момент появления права.
watch(writeoffsAllowed, (allowed) => {
  if (allowed) void loadWriteoffCount()
})

// Участок оператора приходит асинхронно и может смениться на лету: счётчики
// без него не посчитать, поэтому считаем, как только он известен.
watch(
  () => branchStore.activeBraname,
  (bran) => {
    if (bran) void loadSectionCounts()
  },
  { immediate: true },
)
</script>

<template lang="pug">
q-page.wh-desk(role='region', aria-label='Склад участка')
  OperatorBranchBar

  PageTabs(:tabs='tabs', :active-key='activeSection', @select='onSelectTab')

  OperatorInventoryLabelingSection(v-if='activeSection === "labeling"')

  OperatorOwnWarehouseSection(
    v-else-if='activeSection === "warehouse" || activeSection === "stock"',
    :section='activeSection',
    @counts='onWarehouseCounts'
  )

  PvzWriteoffsSection(v-else-if='activeSection === "writeoffs"', @count='onWriteoffCount')

  OperatorContainersSection(v-else, @counts='onContainerCounts')
</template>

<style scoped lang="scss">
.wh-desk {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}
</style>
