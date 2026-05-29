import type { Mutations } from '@coopenomics/sdk'
import type { IBranch } from 'src/entities/Branch/model'
import { api } from '../api'

export type IAddTrustedInput = Mutations.Branches.AddTrustedAccount.IInput['data']
export type IDeleteTrustedInput = Mutations.Branches.DeleteTrustedAccount.IInput['data']

/**
 * Управление доверенными лицами кооперативного участка. Доверенное лицо
 * получает те же операционные права по Столу ПВЗ, что и председатель КУ
 * (приёмка, выдача, маркировка, склад). On-chain действия — `addtrusted`/
 * `deltrusted` контракта branch; auth мутаций — председатель кооператива.
 */
export function useManageTrusted() {
  async function addTrusted(data: IAddTrustedInput): Promise<IBranch> {
    return api.addTrusted(data)
  }

  async function deleteTrusted(data: IDeleteTrustedInput): Promise<IBranch> {
    return api.deleteTrusted(data)
  }

  return { addTrusted, deleteTrusted }
}
