import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Предложение докладки из остатка склада КУ (requirement 76, решения 10–11).
 *
 * Двухфазная докладка у стойки: оператор накидывает опубликованные позиции
 * остатка в предложение пайщику → пайщику немедленно уходит websocket-сигнал →
 * пайщик принимает → по каждой строке создаётся заказ из остатка (stockorder,
 * средства блокируются ИМЕННО в момент акцепта) → сразу акт на подпись в
 * гейте «подписи на месте». Неакцептованное предложение ничего не резервирует.
 *
 *  - `PROPOSED`  — отправлено пайщику, ждёт его решения.
 *  - `ACCEPTED`  — пайщик принял: заказы из остатка созданы.
 *  - `DECLINED`  — пайщик отказался.
 *  - `CANCELLED` — оператор отозвал/переформировал до решения пайщика.
 */
export type MarketplaceStockProposalStatus = 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export const MarketplaceStockProposalStatuses = {
  PROPOSED: 'PROPOSED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, MarketplaceStockProposalStatus>;

/** Строка предложения: опубликованный оффер кооператива + количество. */
export interface MarketplaceStockProposalItem {
  offer_id: string;
  quantity: number;
  /** Снапшот цены публикации на момент накидки (numeric-строка). */
  unit_price: string;
  /** Снапшот наименования — для показа пайщику без дозапросов. */
  product_name: string;
  /**
   * Детерминированный order_hash будущего заказа из остатка — рождается при
   * формировании бандла (оператором у стойки), чтобы и signiss1-акт оператора,
   * и заказ создавались по одному и тому же хэшу.
   */
  order_hash?: string;
  /**
   * АПП-выдачи (registry 1105), уже подписанный ОПЕРАТОРОМ КУ (первая подпись,
   * signiss1) на этапе формирования бандла. Пайщик контрподписывает его
   * (signiss2) одной кнопкой; на финализации бэкенд создаёт заказ из остатка и
   * проводит обе подписи. Хранится в jsonb строки бандла.
   */
  signiss1_act?: ISignedDocumentDomainInterface;
}

export interface MarketplaceStockProposalProps {
  id: string;
  coopname: string;
  braname: string;
  member_account: string;
  operator_account: string;
  items: MarketplaceStockProposalItem[];
  status: MarketplaceStockProposalStatus;
  /** Заказы из остатка, созданные на акцепте (по одному на строку). */
  created_order_ids: string[];
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
