import type { MarketplaceUnitOfMeasure } from './marketplace-offer.types';

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

/**
 * Строка бандла выдачи (паевая модель, компонент 68). Единый путь: бандл несёт
 * И докладку со склада, И уже существующие обычные заказы пайщика — отличает
 * их `order_id`:
 *  - `order_id` отсутствует → ДОКЛАДКА: заказ из остатка родится на подписи
 *    пайщика (stockorder по `order_hash`), паевой резерв — из свободного
 *    паевого «Стола заказов»;
 *  - `order_id` задан → ОБЫЧНЫЙ ЗАКАЗ: он уже принят кооперативом; оператор
 *    зафиксировал факт (кол-во, цену), подписи оператора нет.
 * Пайщик одним нажатием подписывает заявления о возврате паевого взноса
 * имуществом по каждой строке; дальше по каждому заказу идёт сага выдачи
 * (решение совета → акт → закрывающая подпись оператора).
 */
export interface MarketplaceStockProposalItem {
  offer_id: string;
  /** Количество в единицах отпуска для докладки; в базовой единице для строки заказа. */
  quantity: number;
  /** Цена за единицу отпуска (факт для строки заказа, цена публикации для докладки). */
  unit_price: string;
  /** Снапшот наименования — для показа пайщику без дозапросов. */
  product_name: string;
  /** Снапшот базовой единицы измерения товара. */
  unit_of_measure: MarketplaceUnitOfMeasure | null;
  /** Выбранная упаковка каталога (Эпик 18) на момент докладки; null — отпуск по мере. */
  package_id?: string | null;
  /** Содержимое упаковки в базовой единице на момент докладки; 0/undefined — отпуск по мере. */
  package_size?: number;
  /** Существующий обычный заказ пайщика, выдаваемый этим бандлом. Пусто → докладка со склада. */
  order_id?: string;
  /** Детерминированный order_hash: для докладки рождается при формировании, для заказа — его собственный. */
  order_hash?: string;
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
