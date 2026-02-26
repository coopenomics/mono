export namespace Coopstock {
  export const actionName = 'coopstock'

  export interface ICoopstock {
    coopname: string
    braname: string
    hash: string
    units: number
    unit_cost: string
    product_lifecycle_secs: number
    warranty_period_secs: number
    membership_fee_amount: string
    meta: string
  }
}
