import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  IHandoffCodeInput,
  IResolveScanInput,
  MarketplaceHandoffCodeView,
  MarketplaceScanVisitView,
} from '../model';

/** Визит по коду: сервер разбирает строку и отвечает, кто пришёл и за чем. */
export async function resolveScan(data: IResolveScanInput): Promise<MarketplaceScanVisitView> {
  const { [Queries.Marketplace.ResolveScan.name]: result } = await client.Query(
    Queries.Marketplace.ResolveScan.query,
    { variables: { data } },
  );
  return result;
}

/** Код передачи текущего пайщика для показа оператору. */
export async function loadHandoffCode(data: IHandoffCodeInput): Promise<MarketplaceHandoffCodeView> {
  const { [Queries.Marketplace.HandoffCode.name]: result } = await client.Query(
    Queries.Marketplace.HandoffCode.query,
    { variables: { data } },
  );
  return result;
}
