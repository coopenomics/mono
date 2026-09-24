// ВРЕМЕННЫЙ зонд (mkt-order): печатает ответы стенда на спорные входы, ничего не утверждает.
import { describe, it } from 'vitest'
import { CHAIRMAN, ROLES, gqlRaw, tokenOf } from '../core'
import { clearCart, fillCart, seedOffer, PREVIEW_QUERY } from './order.helpers'

describe('probe mkt-order', () => {
  it('probe', async () => {
    const log = (k: string, v: unknown) => console.log(`PROBE ${k}: ${JSON.stringify(v).slice(0, 1500)}`)
    try {
      const m = ROLES.member()
      const mt = await tokenOf(m)
      const potato = await seedOffer('sidorov', 'Картофель деревенский')
      await fillCart(mt, [{ offer_id: potato.id, quantity: 1.5 }])
      log('fractional-preview', await gqlRaw(mt, PREVIEW_QUERY))
      log('fractional-checkout', await gqlRaw(mt, 'mutation{ marketplaceCheckoutCart{ fully_completed failed_lines{ reason } created_orders{ id } } }'))
      await clearCart(mt)
      log('negative-qty', await gqlRaw(mt, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ id } }', { i: { offer_id: potato.id, quantity: -2, delivery_braname: 'krg' } }))
      const bt = await tokenOf(CHAIRMAN)
      log('payout-non-uuid', await gqlRaw(bt, 'query{ marketplaceGetOutgoingPayment(id:"nope"){ payment{ id } } }'))
      log('order-non-uuid', await gqlRaw(mt, 'query{ marketplaceGetOrder(input:{order_id:"nope"}){ id } }'))
    }
    catch (e) {
      console.log(`PROBE error: ${String((e as any)?.message ?? e).slice(0, 1500)}`)
    }
  })
})
