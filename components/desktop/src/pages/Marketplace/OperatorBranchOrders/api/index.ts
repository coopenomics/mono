import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { OrderRegistryPage, OrderRegistryStatusView } from 'src/widgets/Marketplace/OrdersRegistryTable';

export interface ListBranchOrdersVariables {
  statuses?: OrderRegistryStatusView[];
  orderer_account?: string;
  supplier_account?: string;
  offer_id?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Реестр заказов, идущих на конкретный кооперативный участок (стол ПВЗ,
 * Order:read:own-KU). Фильтры и пагинация — серверные; `braname` жёстко
 * задаёт скоуп (гард на бэкенде — председатель/доверенный именно этого КУ).
 */
export async function fetchBranchOrders(
  braname: string,
  variables: ListBranchOrdersVariables = {},
): Promise<OrderRegistryPage> {
  const { page, limit, sortBy, sortOrder, statuses, orderer_account, supplier_account, offer_id } =
    variables;
  const { [Queries.Marketplace.ListBranchOrders.name]: result } = await client.Query(
    Queries.Marketplace.ListBranchOrders.query,
    {
      variables: {
        braname,
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
  return result as OrderRegistryPage;
}
