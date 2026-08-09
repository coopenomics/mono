import type { MarketplaceShipmentTTNData } from './marketplace-shipment.types';

/**
 * Локальная запись ТТН marketplace (registry_id=1103). Документ
 * рендерится через `DocumentDomainService.generateDocument` при создании
 * партии поставки Варианта Б; on-chain не публикуется, в общий реестр
 * документов кооператива не попадает — экспедиторы пока не пайщики и
 * подписывают перевозку вне платформы. Ссылка на ТТН вшивается в АПП
 * приёмки через `Shipment.ttn_document_id`.
 */
export interface MarketplaceTtnDocumentProps {
  id: string;
  coopname: string;
  shipment_id: string;
  ttn_number: string;
  registry_id: number;
  document_hash: string;
  content_html: string;
  meta: Record<string, unknown>;
  supplier_account: string;
  accept_braname: string;
  total_amount: string;
  currency: string;
  /** Исходные поля формы ТТН (фиксируются для аудита и повторного рендера). */
  ttn_data: MarketplaceShipmentTTNData;
  created_at: Date;
  updated_at: Date;
}
