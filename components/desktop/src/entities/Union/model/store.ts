import { Queries } from '@coopenomics/sdk'
import { defineStore } from 'pinia'

const namespace = 'union'

/**
 * Элемент реестра кооперативов: on-chain данные кооператива + данные провайдера
 * (подписки/инстанс/биллинг), сведённые бэкендом (coopback) по coopname.
 */
export type ICooperativeRegistryItem =
  Queries.System.GetCooperativesRegistry.IOutput['getCooperativesRegistry'][number]

export const useUnionStore = defineStore(
  namespace,
  () => {

    const coops = [] as ICooperativeRegistryItem[]

    return {
      coops
    }
  },
  {
    persist: false
  }
  )
