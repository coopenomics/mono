import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 1 / Story 1.9-1.10: L1 онбординг — приём кооперативом ЦПП «Стол заказов».
 * Backend Resolver: marketplace-coop-acceptance.resolver.ts
 * (Query.marketplaceCppStatus + Mutation.marketplaceAcceptCpp).
 *
 * status='active' — кооператив подключил ЦПП; пайщики могут проходить L3 gate.
 * status='not_accepted' — расширение ещё не подключено; пайщикам показывается gate.
 */

export type MarketplaceCppStatusView =
  Queries.Marketplace.MarketplaceCppStatus.IOutput['marketplaceCppStatus'];

export async function fetchCppStatus(): Promise<MarketplaceCppStatusView> {
  const { [Queries.Marketplace.MarketplaceCppStatus.name]: result } = await client.Query(
    Queries.Marketplace.MarketplaceCppStatus.query,
    { variables: {} },
  );
  return result;
}

export interface AcceptCppArgs {
  document_registry_id: number;
  accepted_by_board_decision_id: string;
}

export async function acceptCpp(args: AcceptCppArgs): Promise<MarketplaceCppStatusView> {
  const { [Mutations.Marketplace.MarketplaceAcceptCpp.name]: result } = await client.Mutation(
    Mutations.Marketplace.MarketplaceAcceptCpp.mutation,
    { variables: { input: args } },
  );
  return result;
}
