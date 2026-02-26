export enum LeadRequestPolicy {
  OFFERS_ONLY = 'offers_only',
  ORDERS_ONLY = 'orders_only',
  BOTH = 'both',
}

export enum PublishAccessPolicy {
  ALL_MEMBERS = 'all_members',
  WHITELIST = 'whitelist',
  COUNCIL_ONLY = 'council_only',
}

export interface MarketplaceSettingsEntity {
  id: string;
  coopname: string;
  lead_request_policy: LeadRequestPolicy;
  publish_access_policy: PublishAccessPolicy;
  publish_whitelist: string[];
  moderation_required: boolean;
  cycles_enabled: boolean;
  max_cycle_days: number;
  external_delivery_enabled: boolean;
  internal_delivery_enabled: boolean;
  allowed_category_ids: string[];
  min_unit_cost?: string;
  max_unit_cost?: string;
  created_at: Date;
  updated_at: Date;
}
