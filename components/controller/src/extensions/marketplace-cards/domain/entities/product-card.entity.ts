/**
 * Карточка товара/услуги — хранится в БД до момента match
 */
export enum ProductCardStatus {
  DRAFT = 'draft',
  MODERATION = 'moderation',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ProductCardType {
  OFFER = 'offer',
  ORDER = 'order',
}

export enum DeliveryType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

export enum ContributionType {
  SHARE = 'share',
  MEMBER = 'member',
}

export interface ProductCardEntity {
  id: string;
  coopname: string;
  username: string;
  type: ProductCardType;
  status: ProductCardStatus;
  category_id?: string;
  title: string;
  description: string;
  images: string[];
  unit_cost: string;
  units: number;
  delivery_type: DeliveryType;
  contribution_type: ContributionType;
  product_lifecycle_secs: number;
  warranty_period_secs: number;
  membership_fee_amount: string;
  cancellation_fee_amount: string;
  min_units?: number;
  braname?: string;
  meta?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}
