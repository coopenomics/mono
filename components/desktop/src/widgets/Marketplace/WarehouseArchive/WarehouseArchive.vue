<template lang="pug">
//- Архив склада (решение владельца 19.11.2026): всё имущество, которое было на
//- складе и выбыло — выдано заказчику или списано. Свежее сверху; архив растёт
//- без предела, поэтому читается страницами («Показать ещё»). Строка открывает
//- ту же карточку позиции, что и склад, — с историей движения.
.wh-archive
  WarehouseInventoryTable(
    v-if='firstLoad || rows.length',
    :rows='rows',
    :loading='loading',
    :show-branch='showBranch',
    :total-count='totalCount',
    archive,
    @row-click='openItem'
  )
  EmptyState(
    v-else,
    :title='$t("marketplace.warehouseArchive.emptyTitle")',
    :body='$t("marketplace.warehouseArchive.emptyBody")'
  )
    template(#icon)
      q-icon(name='inventory', size='48px')

  .wh-archive__more(v-if='rows.length < totalCount')
    BaseButton(variant='secondary', size='sm', :loading='loading', @click='loadMore') {{ $t('marketplace.warehouseArchive.loadMore') }}

  InventoryItemDrawer(
    :items='rows',
    :place-label='noPlace',
    :order-route-name='orderRouteName',
    @open-offer='(id) => offerOverlay.open(id)'
  )

  OfferRegistryOverlay(:coopname='coopname', from='warehouse', :show-full-page='showOfferFullPage')
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { FailAlert } from 'src/shared/api'
import { BaseButton, EmptyState } from 'src/shared/ui/base'
import { useFirstLoad } from 'src/shared/lib/composables'
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { useLiveReload } from 'src/shared/lib/realtime'
import { marketLiveTables } from 'src/shared/lib/marketplace'
import { listInventoryArchive, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'
import { InventoryItemDrawer } from 'src/widgets/Marketplace/InventoryItemDrawer'
import { OfferRegistryOverlay } from 'src/widgets/Marketplace/OfferRegistryOverlay'
import { WarehouseInventoryTable } from 'src/widgets/Marketplace/WarehouseInventoryTable'

const props = withDefaults(
  defineProps<{
    /** Пункт выдачи; без него — архив всех доступных участков (стол администратора). */
    braname?: string | null
    /** Колонка пункта выдачи — архив всего кооператива. */
    showBranch?: boolean
    /** Маршрут карточки заказа на этом столе. */
    orderRouteName: string
    /** Переход на полную страницу предложения (стол администратора). */
    showOfferFullPage?: boolean
  }>(),
  { braname: null, showBranch: false, showOfferFullPage: false },
)

const PAGE_SIZE = 50

const route = useRoute()
const coopname = computed(() => String(route.params.coopname ?? ''))
const itemOverlay = useQueryOverlay('item')
const offerOverlay = useQueryOverlay('offer')

const rows = ref<MarketplaceInventoryItemView[]>([])
const totalCount = ref(0)
const page = ref(1)
const loading = ref(false)
const firstLoad = useFirstLoad(loading)

/**
 * Читает страницы с первой по `upTo` и склеивает их: перечитывание по ленте
 * сохраняет уже показанное. Страница узла — не больше 100 строк.
 */
async function load(upTo: number): Promise<void> {
  loading.value = true
  try {
    const collected: MarketplaceInventoryItemView[] = []
    let total = 0
    for (let n = 1; n <= upTo; n += 1) {
      const result = await listInventoryArchive({ braname: props.braname, page: n, limit: PAGE_SIZE })
      collected.push(...result.items)
      total = result.totalCount
      if (n >= result.totalPages) break
    }
    const seen = new Set<string>()
    rows.value = collected.filter((row) => (seen.has(String(row.id)) ? false : (seen.add(String(row.id)), true)))
    totalCount.value = total
    page.value = upTo
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

function loadMore(): void {
  void load(page.value + 1)
}

function openItem(row: MarketplaceInventoryItemView): void {
  itemOverlay.open(row.id)
}

function noPlace(): string {
  return '—'
}

onMounted(() => void load(1))
watch(() => props.braname, () => void load(1))
// Выдача и списание меняют позицию склада — архив перечитывается по ленте.
useLiveReload(marketLiveTables('warehouse'), () => load(page.value))
</script>

<style scoped lang="scss">
.wh-archive {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__more {
    display: flex;
    justify-content: center;
  }
}
</style>
