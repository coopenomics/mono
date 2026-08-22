import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { AdminOfferPage, AdminOfferStatusView } from '../types';

export interface ListAllOffersVariables {
  statuses?: AdminOfferStatusView[];
  supplier_account?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Реестр всех предложений кооператива любого статуса (стол администратора,
 * Offer:read:all). Фильтры (статус/поставщик) и пагинация — серверные,
 * передаются единым input'ом.
 */
export async function fetchAllOffers(
  variables: ListAllOffersVariables = {},
): Promise<AdminOfferPage> {
  const { page, limit, sortBy, sortOrder, statuses, supplier_account } = variables;
  const { [Queries.Marketplace.ListAllOffers.name]: result } = await client.Query(
    Queries.Marketplace.ListAllOffers.query,
    {
      variables: {
        input: {
          statuses,
          supplier_account,
          page: page ?? 1,
          limit: limit ?? 50,
          sortBy: sortBy ?? 'created_at',
          sortOrder: sortOrder ?? 'DESC',
        },
      },
    },
  );
  // Zeus отдаёт DateTime как unknown; сужаем скалярную дату до строки во view-типе.
  return result as AdminOfferPage;
}
