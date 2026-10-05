/**
 * Стол заказов: условия строк таблицы прав на сервере
 * (test-registry/marketplace.rights-table.yaml).
 *
 * Права заказчика действуют после подключения: оферта программы подписана и
 * пункт выдачи выбран. До этого сервер выполняет только операции подключения.
 * До 04.10.2026 условие знал один рабочий стол: он прятал страницы, а прямой
 * запрос к серверу проходил — каталог читался, корзина менялась, оформление
 * доходило до проверки корзины (C28-87).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, caseName, freshMember, gqlRaw, login } from '../core'
import { KRG } from './flow'
import { chooseDeliveryPoint, signOffer } from './onboarding.helpers'

const NOT_ONBOARDED = 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED'

const CATALOG = 'query{ marketplaceListCatalog{ __typename } }'
const CART = 'query{ marketplaceGetCart{ __typename } }'
const MY_ORDERS = 'query{ marketplaceListMyOrders{ __typename } }'
const CLEAR_CART = 'mutation{ marketplaceClearCart{ __typename } }'
const CHECKOUT_PAYLOADS = 'query{ marketplaceCheckoutSignablePayloads{ __typename } }'

const WHO_AM_I = 'query{ marketplaceWhoAmI{ username marketplace_roles } }'
const CPP_STATUS = 'query{ marketplaceCppStatus{ status } }'
const ONBOARDING_STATE = 'query{ marketplaceOnboardingState{ requires_gate source } }'
const MY_SUPPLIER_STATE = 'query{ marketplaceMySupplierState{ status } }'
const KU_LIST = 'query($d:ListMarketplaceKUInput!){ marketplaceListKUDetails(data:$d){ __typename } }'

let newcomer: Who
let token = ''

/** Код отказа операции либо null, если сервер её выполнил. */
async function denial(query: string, variables?: Record<string, unknown>): Promise<string | null> {
  const r = await gqlRaw(token, query, variables)
  const e = r.errors[0]
  return e ? String(e.code) : null
}

/** Операция прошла проверку прав: ответ либо деловая ошибка, но не отказ в доступе. */
async function passesRights(query: string, variables?: Record<string, unknown>): Promise<void> {
  const r = await gqlRaw(token, query, variables)
  const e = r.errors[0]
  expect(e?.httpStatus === 403 || e?.httpStatus === 401 ? `${e.code}: ${e.message}` : null, query).toBeNull()
}

beforeAll(async () => {
  newcomer = freshMember({ prefix: 'mktr' })
  token = await login(newcomer)
}, 300_000)

describe('Стол заказов: права заказчика действуют после подключения', () => {
  it(caseName('mkt.rights.side.01', 'пайщик без оферты и пункта выдачи получает отказ на каталог, корзину, свои заказы и оформление'), async () => {
    for (const query of [CATALOG, CART, MY_ORDERS, CLEAR_CART, CHECKOUT_PAYLOADS])
      expect(await denial(query), query).toBe(NOT_ONBOARDED)
  })

  it(caseName('mkt.rights.happy.01', 'пайщик без подключения читает состояние приложения, свои роли, ход подключения, пункты выдачи и свою запись поставщика'), async () => {
    await passesRights(WHO_AM_I)
    await passesRights(CPP_STATUS)
    await passesRights(ONBOARDING_STATE)
    await passesRights(MY_SUPPLIER_STATE)
    await passesRights(KU_LIST, { d: { coopname: COOP } })
  })

  it(caseName('mkt.rights.side.06', 'подписи оферты без пункта выдачи мало: каталог и корзина закрыты, пока пункт не выбран'), async () => {
    await signOffer(newcomer)
    expect(await denial(CATALOG)).toBe(NOT_ONBOARDED)
    expect(await denial(CART)).toBe(NOT_ONBOARDED)
  }, 180_000)

  it(caseName('mkt.rights.happy.02', 'после подписи оферты и выбора пункта выдачи пайщику открыты каталог, корзина и свои заказы'), async () => {
    await chooseDeliveryPoint(newcomer, KRG)
    for (const query of [CATALOG, CART, MY_ORDERS])
      expect(await denial(query), query).toBeNull()
  }, 180_000)
})
