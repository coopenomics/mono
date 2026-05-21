import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 1 / Story 1.4: L3 онбординг пайщика — состояние gate для
 * marketplace. Сервер сам определяет username из JWT context.
 */

export type MarketplaceOnboardingStateView =
  Queries.Marketplace.MarketplaceOnboardingState.IOutput['marketplaceOnboardingState'];

export async function fetchOnboardingState(): Promise<MarketplaceOnboardingStateView> {
  const { [Queries.Marketplace.MarketplaceOnboardingState.name]: result } = await client.Query(
    Queries.Marketplace.MarketplaceOnboardingState.query,
    {},
  );
  return result;
}
