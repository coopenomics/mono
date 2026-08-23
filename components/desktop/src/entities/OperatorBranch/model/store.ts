import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useBranchStore } from 'src/entities/Branch/model'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import type { MarketplaceWarehouseSettings } from 'src/entities/MarketplaceStorage'
import { fetchWhoAmI, type IMarketplaceWhoAmI } from '../api'
import type { IOperatorBranch } from './types'

const namespace = 'operatorBranchStore'

/**
 * Контекст оператора Стола ПВЗ: на каких КУ текущий пайщик работает оператором
 * и какой из них активен. Источник «моих КУ» — `marketplaceWhoAmI.branches`
 * (trustee ИЛИ trusted, см. backend `MarketplaceKuChairmanService`); он работает
 * для любой роли, включая доверенное лицо без admin/board.
 *
 * Обогащение активного КУ:
 *   - `marketplaceListKUDetails` — детализация ПВЗ (адрес/статус/координаты/часы),
 *     читают все роли;
 *   - core `getBranches` — short_name + ФИО trustee/trusted, доступно только
 *     председателю/совету. Если недоступно (доверенное-только) — мягкая
 *     деградация: имя = адрес ПВЗ, без падения.
 *
 * Активный КУ: один — выбирается автоматически; несколько — селектор в шапке.
 * Никаких кодов КУ в UI: стол спроецирован на участок, а не на их список.
 */
export const useOperatorBranchStore = defineStore(namespace, () => {
  const branchStore = useBranchStore()
  const kuStore = useMarketplaceKUDetailsStore()

  const who = ref<IMarketplaceWhoAmI | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const activeBraname = ref<string | null>(null)

  const operatorBranames = computed<string[]>(() => who.value?.branches ?? [])
  const isOperator = computed(() => operatorBranames.value.length > 0)
  const hasMultiple = computed(() => operatorBranames.value.length > 1)

  /**
   * Эпик 19: три независимых флага складского контура — боксы, координатные
   * ячейки и обязательность места при приёмке. Приходят тем же `whoAmI`, что и
   * список КУ, поэтому отдельного запроса не нужно. Пока настройки не приехали
   * (гость, упавший запрос) — контур выключен: это безопасный дефолт, экраны
   * работают как до эпика.
   */
  const warehouseSettings = computed<MarketplaceWarehouseSettings>(() => ({
    containers_enabled: who.value?.warehouse_settings?.containers_enabled ?? false,
    cells_enabled: who.value?.warehouse_settings?.cells_enabled ?? false,
    posting_on_reception_required:
      who.value?.warehouse_settings?.posting_on_reception_required ?? false,
  }))

  /** Адресное хранение показывается, только если включён хотя бы один из двух контуров. */
  const addressedStorageEnabled = computed(
    () => warehouseSettings.value.containers_enabled || warehouseSettings.value.cells_enabled,
  )

  const branches = computed<IOperatorBranch[]>(() => {
    const me = who.value?.username ?? ''
    const detailsByBra = new Map(kuStore.details.map((d) => [d.coreBraname, d]))
    const branchByBra = new Map(branchStore.branches.map((b) => [b.braname, b]))
    return operatorBranames.value.map((braname) => {
      const details = detailsByBra.get(braname) ?? null
      const branch = branchByBra.get(braname) ?? null
      return {
        braname,
        name: branch?.short_name || branch?.full_name || '',
        address: details?.addressFull || branch?.fact_address || branch?.full_address || '',
        isTrustee: branch?.trustee?.username === me,
        details,
        branch,
      }
    })
  })

  const activeBranch = computed<IOperatorBranch | null>(() =>
    activeBraname.value
      ? branches.value.find((b) => b.braname === activeBraname.value) ?? null
      : null,
  )

  async function load(coopname: string): Promise<void> {
    loading.value = true
    try {
      // whoAmI — единственный источник «моих КУ». Если упал (гость/не-пайщик),
      // стол деградирует в EmptyState «вы не оператор», а не в ошибку.
      try {
        who.value = await fetchWhoAmI()
      } catch {
        who.value = null
      }
      const list = who.value?.branches ?? []
      if (list.length) {
        // Детали ПВЗ — читают все роли (chairman/member/user).
        await kuStore.load({ coopname, onlyActive: false })
        // Обогащение core-веткой — best-effort: доверенному-только ветки
        // закрыты по ролям, тогда остаёмся на braname/адресе ПВЗ.
        try {
          await branchStore.loadBranches({ coopname })
        } catch {
          /* нет прав читать ветки — деградируем мягко */
        }
      }
      if (!activeBraname.value || !list.includes(activeBraname.value)) {
        activeBraname.value = list[0] ?? null
      }
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function ensureLoaded(coopname: string): Promise<void> {
    if (!loaded.value && !loading.value) await load(coopname)
  }

  function setActive(braname: string): void {
    if (operatorBranames.value.includes(braname)) activeBraname.value = braname
  }

  return {
    who,
    loading,
    loaded,
    activeBraname,
    operatorBranames,
    isOperator,
    hasMultiple,
    warehouseSettings,
    addressedStorageEnabled,
    branches,
    activeBranch,
    load,
    ensureLoaded,
    setActive,
  }
})
