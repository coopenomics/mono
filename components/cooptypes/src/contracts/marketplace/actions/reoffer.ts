export namespace Reoffer {
  export const actionName = 'reoffer'

  export interface IReoffer {
    coopname: string
    request_hash: string
    new_hash: string
    new_unit_cost: string
    new_meta: string
  }
}
