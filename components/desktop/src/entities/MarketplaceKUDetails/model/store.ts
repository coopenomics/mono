import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { api } from '../api'
import type {
  IDetailKUInput,
  IListMarketplaceKUInput,
  IMarketplaceKUDetails,
  ISetKUStatusInput,
} from './types'

const namespace = 'marketplaceKUDetailsStore'

interface IMarketplaceKUDetailsStore {
  details: Ref<IMarketplaceKUDetails[]>
  isLoading: Ref<boolean>
  load: (data: IListMarketplaceKUInput) => Promise<void>
  detailKU: (data: IDetailKUInput) => Promise<IMarketplaceKUDetails>
  setStatus: (data: ISetKUStatusInput) => Promise<IMarketplaceKUDetails>
  retryGeocode: (coopname: string, coreBraname: string) => Promise<IMarketplaceKUDetails>
}

export const useMarketplaceKUDetailsStore = defineStore(
  namespace,
  (): IMarketplaceKUDetailsStore => {
    const details = ref<IMarketplaceKUDetails[]>([])
    const isLoading = ref(false)

    const load = async (data: IListMarketplaceKUInput) => {
      isLoading.value = true
      try {
        details.value = await api.listKUDetails(data)
      } finally {
        isLoading.value = false
      }
    }

    const replaceLocal = (entity: IMarketplaceKUDetails) => {
      const idx = details.value.findIndex(
        (d) => d.coopname === entity.coopname && d.coreBraname === entity.coreBraname
      )
      if (idx >= 0) details.value.splice(idx, 1, entity)
      else details.value.push(entity)
    }

    const detailKU = async (data: IDetailKUInput) => {
      const saved = await api.detailKU(data)
      replaceLocal(saved)
      return saved
    }

    const setStatus = async (data: ISetKUStatusInput) => {
      const saved = await api.setKUStatus(data)
      replaceLocal(saved)
      return saved
    }

    const retryGeocode = async (coopname: string, coreBraname: string) => {
      const saved = await api.retryGeocode(coopname, coreBraname)
      replaceLocal(saved)
      return saved
    }

    return {
      details,
      isLoading,
      load,
      detailKU,
      setStatus,
      retryGeocode,
    }
  }
)
