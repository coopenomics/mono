import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { AdminOrderPage, AdminOrderStatusView } from '../types';

export interface ListAllOrdersVariables {
  statuses?: AdminOrderStatusView[];
  orderer_account?: string;
  supplier_account?: string;
  offer_id?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Реестр всех заказов кооператива со статусами (стол администратора,
 * Order:read:all). Фильтры (статус/заказчик/поставщик/предложение) и
 * пагинация — серверные.
 */
export async function fetchAllOrders(
  variables: ListAllOrdersVariables = {},
): Promise<AdminOrderPage> {
  const { page, limit, sortBy, sortOrder, statuses, orderer_account, supplier_account, offer_id } =
    variables;
  const { [Queries.Marketplace.ListAllOrders.name]: result } = await client.Query(
    Queries.Marketplace.ListAllOrders.query,
    {
      variables: {
        input: {
          orderer_account,
          supplier_account,
          offer_id,
          statuses,
        },
        options: {
          page: page ?? 1,
          limit: limit ?? 50,
          sortBy: sortBy ?? 'updated_at',
          sortOrder: sortOrder ?? 'DESC',
        },
      },
    },
  );
  // Zeus отдаёт DateTime как unknown; сужаем скалярную дату до строки во view-типе.
  return result as AdminOrderPage;
}
