import { Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

export type IMarketplaceWhoAmI =
  Queries.Marketplace.WhoAmI.IOutput[typeof Queries.Marketplace.WhoAmI.name]

/**
 * Контекст текущего пайщика в Столе заказов: core/marketplace-роли + список
 * браней КУ, на которых он оператор (trustee ИЛИ trusted). Сервер сам берёт
 * пайщика из JWT — никаких идентификаторов с фронта не передаём.
 */
export async function fetchWhoAmI(): Promise<IMarketplaceWhoAmI> {
  const { [Queries.Marketplace.WhoAmI.name]: result } = await client.Query(
    Queries.Marketplace.WhoAmI.query,
    { variables: {} },
  )
  return result
}

export const api = { fetchWhoAmI }
