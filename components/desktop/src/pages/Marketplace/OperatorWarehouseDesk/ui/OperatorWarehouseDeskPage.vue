<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { OperatorBranchBar } from 'src/entities/OperatorBranch'
import { useDesktopStore } from 'src/entities/Desktop'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { OperatorInventoryLabelingSection } from 'src/pages/Marketplace/OperatorInventoryLabeling'
import { OperatorOwnWarehouseSection } from 'src/pages/Marketplace/OperatorOwnWarehouse'
import { OperatorContainersSection } from 'src/pages/Marketplace/OperatorContainers'

/**
 * Стол «Склад моего КУ» — всё складское хозяйство участка одной страницей.
 *
 * Раскладка, склад, обезличенный остаток и боксы раньше жили отдельными
 * пунктами меню, хотя это одна и та же сущность с разных сторон: карта склада,
 * список того, что на ней лежит, и тара, в которой оно лежит. Меню от этого
 * пухло, а боксы заводят однажды и потом не открывают месяцами.
 *
 * Открывается на раскладке — это ежедневная работа оператора; остальные
 * разделы рядом, за один клик.
 */

const SECTIONS = ['labeling', 'warehouse', 'stock', 'containers', 'types'] as const
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

const counts = ref({ warehouse: 0, stock: 0, containers: 0, types: 0 })

const tabs = computed<PageTab[]>(() => {
  const list: PageTab[] = [
    { key: 'labeling', label: 'Раскладка и маркировка' },
    { key: 'warehouse', label: 'Склад', count: counts.value.warehouse },
    { key: 'stock', label: 'Остатки', count: counts.value.stock },
  ]
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

// Право на боксы может отозваться, пока оператор стоит на их разделе — тогда
// возвращаем его на раскладку, чтобы он не смотрел в пустой экран.
watch([containersAllowed, activeSection], ([allowed, section]) => {
  if (!allowed && (section === 'containers' || section === 'types')) {
    void router.replace({
      name: 'marketplace-pvz-warehouse',
      params: { coopname: route.params.coopname, section: DEFAULT_SECTION },
    })
  }
})

function onWarehouseCounts(value: { warehouse: number; stock: number }): void {
  counts.value = { ...counts.value, ...value }
}

function onContainerCounts(value: { containers: number; types: number }): void {
  counts.value = { ...counts.value, ...value }
}
</script>

<template lang="pug">
q-page.wh-desk(role='region', aria-label='Склад моего КУ')
  OperatorBranchBar

  PageTabs(:tabs='tabs', :active-key='activeSection', @select='onSelectTab')

  OperatorInventoryLabelingSection(v-if='activeSection === "labeling"')

  OperatorOwnWarehouseSection(
    v-else-if='activeSection === "warehouse" || activeSection === "stock"',
    :section='activeSection',
    @counts='onWarehouseCounts'
  )

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
