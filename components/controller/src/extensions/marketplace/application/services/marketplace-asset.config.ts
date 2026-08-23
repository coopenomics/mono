export const MARKETPLACE_ASSET_CONFIG = Symbol('MARKETPLACE_ASSET_CONFIG');

export interface MarketplaceAssetConfig {
  symbol: string;
  decimals: number;
}
