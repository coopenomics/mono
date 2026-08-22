import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';

export const marketplaceAssetConfigProvider = {
  provide: MARKETPLACE_ASSET_CONFIG,
  useFactory: (): MarketplaceAssetConfig => ({
    symbol: platformSettings().blockchain.rootGovernSymbol,
    decimals: platformSettings().blockchain.rootGovernPrecision,
  }),
};
