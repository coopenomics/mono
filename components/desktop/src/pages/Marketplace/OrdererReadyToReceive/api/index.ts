import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type {
  MarketplaceOrderIssuanceView,
  MarketplaceOrderIssuanceFactView,
  MarketplaceIssuanceAggregateView,
  MarketplaceIssuanceResultView,
  SignedDocumentInput,
} from '../../OperatorIssuance/api';
import type { MarketplaceOrderIssuanceView } from '../../OperatorIssuance/api';

// Финальную подпись заказчик ставит сам в своём кабинете: переиспользуем
// запрос акта (агрегат с подписью председателя) и mutation финализации.
export { getOrdererSignablePayload, finalizeIssuance } from '../../OperatorIssuance/api';

export async function listMyReadyToReceive(): Promise<MarketplaceOrderIssuanceView[]> {
  const { [Queries.Marketplace.ListMyReadyToReceive.name]: result } = await client.Query(
    Queries.Marketplace.ListMyReadyToReceive.query,
    {},
  );
  // Zeus отдаёт DateTime как unknown; сужаем скалярную дату до строки во view-типе.
  return result as MarketplaceOrderIssuanceView[];
}
