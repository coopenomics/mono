import config from '~/config/config';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';

export const marketplaceAssetConfigProvider = {
  provide: MARKETPLACE_ASSET_CONFIG,
  useFactory: (): MarketplaceAssetConfig => ({
    symbol: config.blockchain.root_govern_symbol,
    decimals: config.blockchain.root_govern_precision,
  }),
};
