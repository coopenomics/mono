import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceBranchSummaryView =
  Queries.Marketplace.GetBranchSummary.IOutput['marketplaceGetBranchSummary'];

export type MarketplaceBranchSummaryMovementsView =
  Queries.Marketplace.GetBranchSummaryMovements.IOutput['marketplaceGetBranchSummaryMovements'];

export type MarketplaceBranchSummaryMovement = MarketplaceBranchSummaryMovementsView['items'][number];

/** Сводка участка для пайщика: пункт выдачи, кошельки участка, взносы инициаторов. */
export async function getBranchSummary(braname: string): Promise<MarketplaceBranchSummaryView> {
  const { [Queries.Marketplace.GetBranchSummary.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchSummary.query,
    { variables: { braname } },
  );
  return result;
}

/** Движения по общему кошельку участка: дата, операция и сумма. */
export async function getBranchSummaryMovements(
  braname: string,
  options?: Queries.Marketplace.GetBranchSummaryMovements.IInput['options'],
): Promise<MarketplaceBranchSummaryMovementsView> {
  const { [Queries.Marketplace.GetBranchSummaryMovements.name]: result } = await client.Query(
    Queries.Marketplace.GetBranchSummaryMovements.query,
    { variables: { braname, options } },
  );
  return result;
}
