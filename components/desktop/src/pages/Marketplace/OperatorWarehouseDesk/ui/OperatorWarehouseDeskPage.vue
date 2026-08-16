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

const SECTIONS = ['labeling', 'warehouse', 'stock', 'writeoffs', 'containers', 'types'] as const
type WarehouseSection = (typeof SECTIONS)[number]

const DEFAULT_SECTION: WarehouseSection = 'labeling'

const route = useRoute()
const router = useRouter()
const desktop = useDesktopStore()

/** Раздел живёт в адресе: ссылку на нужную вкладку можно послать коллеге. */
const activeSection = computed<WarehouseSection>(() => {
  const raw = String(route.params.section ?? '')
  return (SECTIONS as readonly string[]).includes(raw)
    ? (raw as WarehouseSection)
    : DEFAULT_SECTION
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

const counts = ref({ warehouse: 0, stock: 0, writeoffs: 0, containers: 0, types: 0 })

const tabs = computed<PageTab[]>(() => {
  const list: PageTab[] = [
    { key: 'labeling', label: 'Раскладка и маркировка' },
    { key: 'warehouse', label: 'Склад', count: counts.value.warehouse },
    { key: 'stock', label: 'Остатки', count: counts.value.stock },
  ]
  if (writeoffsAllowed.value) {
    list.push({ key: 'writeoffs', label: 'Списание', count: counts.value.writeoffs })
  }
  if (containersAllowed.value) {
    list.push(
      { key: 'containers', label: 'Боксы', count: counts.value.containers },
      { key: 'types', label: 'Типы боксов', count: counts.value.types },
    )
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
  const lost =
    (!containers && (section === 'containers' || section === 'types')) ||
    (!writeoffs && section === 'writeoffs')
  if (!lost) return
  void router.replace({
    name: 'marketplace-pvz-warehouse',
    params: { coopname: route.params.coopname, section: DEFAULT_SECTION },
  })
})

function onWarehouseCounts(value: { warehouse: number; stock: number }): void {
  counts.value = { ...counts.value, ...value }
}

function onContainerCounts(value: { containers: number; types: number }): void {
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

onMounted(() => void loadWriteoffCount())

// Право может прийти позже загрузки стола (grants подтягиваются асинхронно) —
// тогда считаем в момент появления права.
watch(writeoffsAllowed, (allowed) => {
  if (allowed) void loadWriteoffCount()
})
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

  OperatorContainersSection(
    v-else,
    :section='activeSection === "types" ? "types" : "containers"',
    @counts='onContainerCounts'
  )
</template>

<style scoped lang="scss">
.wh-desk {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}
</style>
