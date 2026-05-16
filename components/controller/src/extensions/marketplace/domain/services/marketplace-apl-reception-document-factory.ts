import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { MarketplaceAplReceptionDomainEntity } from '../entities/marketplace-apl-reception.entity';
import type { MarketplaceOrderDomainEntity } from '../entities/marketplace-order.entity';

/**
 * Story 598-15 / FR45: фабрика подписного документа `Document2` для АПП
 * приёмки на КУ. Формирует payload per-Order, который клиент подписывает
 * (на стороне поставщика / председателя) и возвращает в mutation
 * `marketplaceSignAplReception*`.
 *
 * Структура `Document2`:
 *   - `version` — версия шаблона; для АПП v1 = '1.0';
 *   - `meta` — JSON.stringify({ schema, reception_id, order_id, ... });
 *   - `meta_hash` — sha256(meta);
 *   - `doc_hash` — sha256(canonical(order_hash + accept_braname + ...));
 *   - `hash` — sha256(doc_hash || meta_hash);
 *   - `signatures` — заполняются клиентом, backend проверяет наличие.
 */
export interface AplReceptionSignablePayload {
  order_id: string;
  order_hash: string;
  version: string;
  meta: string;
  meta_hash: string;
  doc_hash: string;
  /** hash без подписей — клиент подписывает именно этот digest. */
  hash: string;
}

export const MARKETPLACE_APL_RECEPTION_DOCUMENT_FACTORY = Symbol(
  'MARKETPLACE_APL_RECEPTION_DOCUMENT_FACTORY'
);

@Injectable()
export class MarketplaceAplReceptionDocumentFactory {
  public static readonly DOCUMENT_VERSION = '1.0';
  public static readonly SCHEMA_SUPPLIER = 'marketplace.apl-reception.signsupp.v1';
  public static readonly SCHEMA_CHAIRMAN = 'marketplace.apl-reception.signchair.v1';

  /**
   * Сформировать unsigned payload для подписи поставщиком.
   * Клиент берёт `payload.hash`, подписывает приватным ключом и возвращает
   * `IDocument2` с заполненным `signatures` в mutation `signAsSupplier`.
   */
  buildSupplierPayload(
    reception: MarketplaceAplReceptionDomainEntity,
    order: MarketplaceOrderDomainEntity,
    accept_braname: string
  ): AplReceptionSignablePayload {
    const fact = reception.fact_quantity_per_order.find((f) => f.order_id === order.id);
    const fact_quantity = fact?.fact_quantity ?? order.quantity;
    return this.build({
      schema: MarketplaceAplReceptionDocumentFactory.SCHEMA_SUPPLIER,
      reception,
      order,
      accept_braname,
      fact_quantity,
    });
  }

  /**
   * Сформировать unsigned payload для закрывающей подписи председателя КУ.
   * Используется тот же hash-input что и у поставщика, но schema
   * отличается — чтобы клиент видел нужный документ-шаблон.
   */
  buildChairmanPayload(
    reception: MarketplaceAplReceptionDomainEntity,
    order: MarketplaceOrderDomainEntity,
    accept_braname: string
  ): AplReceptionSignablePayload {
    const fact = reception.fact_quantity_per_order.find((f) => f.order_id === order.id);
    const fact_quantity = fact?.fact_quantity ?? order.quantity;
    return this.build({
      schema: MarketplaceAplReceptionDocumentFactory.SCHEMA_CHAIRMAN,
      reception,
      order,
      accept_braname,
      fact_quantity,
    });
  }

  private build(input: {
    schema: string;
    reception: MarketplaceAplReceptionDomainEntity;
    order: MarketplaceOrderDomainEntity;
    accept_braname: string;
    fact_quantity: number;
  }): AplReceptionSignablePayload {
    const meta = JSON.stringify({
      schema: input.schema,
      reception_id: input.reception.id,
      order_id: input.order.id,
      order_hash: input.order.order_hash,
      accept_braname: input.accept_braname,
      fact_quantity: input.fact_quantity,
      total_amount: input.reception.total_amount,
      created_at: input.reception.created_at.toISOString(),
    });
    const meta_hash = sha256(meta);
    const doc_payload = `${input.order.order_hash}|${input.accept_braname}|${input.fact_quantity}|${input.reception.id}`;
    const doc_hash = sha256(doc_payload);
    const hash = sha256(`${doc_hash}|${meta_hash}`);
    return {
      order_id: input.order.id,
      order_hash: input.order.order_hash,
      version: MarketplaceAplReceptionDocumentFactory.DOCUMENT_VERSION,
      meta,
      meta_hash,
      doc_hash,
      hash,
    };
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
